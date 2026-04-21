/**
 * SkillHub Service
 * Manages interactions with the SkillHub CLI for skills management
 * SkillHub is a Chinese mirror of ClawHub with faster access in China
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';
import { getOpenClawConfigDir, ensureDir, quoteForCmd } from '../utils/paths';

export interface SkillHubSearchParams {
    query: string;
    limit?: number;
}

export interface SkillHubInstallParams {
    slug: string;
    version?: string;
    force?: boolean;
}

export interface SkillHubSkillResult {
    slug: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    downloads?: number;
    stars?: number;
}

export class SkillHubService {
    private workDir: string;
    private cliPath: string;
    private useNodeRunner: boolean;
    private ansiRegex: RegExp;

    constructor() {
        this.workDir = getOpenClawConfigDir();
        ensureDir(this.workDir);

        // Try to find skillhub CLI
        const possiblePaths = this.findSkillHubCli();
        this.cliPath = possiblePaths;
        this.useNodeRunner = !possiblePaths.includes('skillhub');

        const esc = String.fromCharCode(27);
        const csi = String.fromCharCode(155);
        const pattern = `(?:${esc}|${csi})[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`;
        this.ansiRegex = new RegExp(pattern, 'g');
    }

    private findSkillHubCli(): string {
        // Check if skillhub CLI is available in PATH
        const npmPrefix = process.env.PREFIX || path.join(app.getPath('home'), '.npm');
        const possiblePaths = [
            'skillhub',  // Direct command if installed globally
            path.join(npmPrefix, 'bin', 'skillhub'),
            path.join(app.getPath('home'), '.npm', '_npx', 'skillhub-cli-tencent', 'node_modules', '.bin', 'skillhub'),
            path.join(this.workDir, 'bin', 'skillhub'),
        ];

        for (const p of possiblePaths) {
            if (p === 'skillhub') {
                // Just check if command exists (will be found at runtime)
                return p;
            }
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return 'npx';  // Fallback to npx
    }

    private stripAnsi(line: string): string {
        return line.replace(this.ansiRegex, '').trim();
    }

    /**
     * Run a SkillHub CLI command
     */
    private async runCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            let command: string;
            let commandArgs: string[];

            if (this.cliPath === 'npx') {
                command = 'npx';
                commandArgs = ['skillhub-cli-tencent', ...args];
            } else if (this.cliPath === 'skillhub') {
                command = 'skillhub';
                commandArgs = args;
            } else {
                command = this.cliPath;
                commandArgs = args;
            }

            const displayCommand = [command, ...commandArgs].join(' ');
            console.log(`Running SkillHub command: ${displayCommand}`);

            const isWin = process.platform === 'win32';
            const { NODE_OPTIONS: _nodeOptions, ...baseEnv } = process.env;
            const env = {
                ...baseEnv,
                CI: 'true',
                FORCE_COLOR: '0',
                SKILLHUB_WORKDIR: this.workDir,
            };

            const child = spawn(command, commandArgs, {
                cwd: this.workDir,
                shell: isWin,
                env,
                windowsHide: true,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                console.error('SkillHub process error:', error);
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    console.error(`SkillHub command failed with code ${code}`);
                    console.error('Stderr:', stderr);
                    reject(new Error(`Command failed: ${stderr || stdout}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Search for skills
     */
    async search(params: SkillHubSearchParams): Promise<SkillHubSkillResult[]> {
        try {
            // Try JSON output first for easier parsing
            const args = ['search', params.query, '--json'];
            
            const output = await this.runCommand(args);
            if (!output || output.includes('No skills found')) {
                return [];
            }

            // Try to parse as JSON
            try {
                const json = JSON.parse(output);
                if (Array.isArray(json)) {
                    return json.map((item: any) => ({
                        slug: item.slug || item.name || '',
                        name: item.name || item.slug || '',
                        description: item.description || '',
                        version: item.version || 'latest',
                        author: item.author,
                        downloads: item.downloads,
                        stars: item.stars,
                    }));
                }
            } catch {
                // Not JSON, parse as text
            }

            // Fallback: parse text output
            const lines = output.split('\n').filter(l => l.trim());
            return lines.map(line => {
                const cleanLine = this.stripAnsi(line);

                // Format could be: slug vversion description (score)
                let match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)\s+(.+)$/);
                if (match) {
                    const slug = match[1];
                    const version = match[2];
                    let description = match[3];
                    description = description.replace(/\(\d+\.\d+\)$/, '').trim();

                    return {
                        slug,
                        name: slug,
                        version,
                        description,
                    };
                }

                // Fallback without version
                match = cleanLine.match(/^(\S+)\s+(.+)$/);
                if (match) {
                    const slug = match[1];
                    let description = match[2];
                    description = description.replace(/\(\d+\.\d+\)$/, '').trim();

                    return {
                        slug,
                        name: slug,
                        version: 'latest',
                        description,
                    };
                }
                return null;
            }).filter((s): s is SkillHubSkillResult => s !== null);
        } catch (error) {
            console.error('SkillHub search error:', error);
            throw error;
        }
    }

    /**
     * Install a skill
     */
    async install(params: SkillHubInstallParams): Promise<void> {
        const args = ['install', params.slug];

        if (params.version) {
            args.push('--version', params.version);
        }

        if (params.force) {
            args.push('--force');
        }

        await this.runCommand(args);
    }

    /**
     * List installed skills
     */
    async listInstalled(): Promise<Array<{ slug: string; version: string; source: string; baseDir: string }>> {
        try {
            const output = await this.runCommand(['list']);
            if (!output || output.includes('No installed skills')) {
                return [];
            }

            const lines = output.split('\n').filter(l => l.trim());
            return lines.map(line => {
                const cleanLine = this.stripAnsi(line);
                const match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)/);
                if (match) {
                    const slug = match[1];
                    return {
                        slug,
                        version: match[2],
                        source: 'skillhub',
                        baseDir: path.join(this.workDir, 'skills', slug),
                    };
                }
                return null;
            }).filter((s): s is { slug: string; version: string; source: string; baseDir: string } => s !== null);
        } catch (error) {
            console.error('SkillHub list error:', error);
            return [];
        }
    }
}
