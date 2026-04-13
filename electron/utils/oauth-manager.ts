/**
 * 统一OAuth管理器
 * 合并 browser-oauth.ts 和 device-oauth.ts 的功能
 * 支持多种OAuth流程：Google、OpenAI、MiniMax
 */
import { EventEmitter } from 'events';
import { BrowserWindow, shell } from 'electron';
import { logger } from './logger';
import { saveProvider, getProvider, ProviderConfig } from './secure-storage';
import { getProviderDefaultModel } from './provider-registry';
import { proxyAwareFetch } from './proxy-fetch';
import {
  saveOAuthTokenToOpenClaw,
  setOpenClawDefaultModelWithOverride,
} from './openclaw-auth';
import { getProviderService } from '../services/providers/provider-service';
import { getSecretStore } from '../services/secrets/secret-store';

// 导入具体的OAuth实现
import { loginGeminiCliOAuth, type GeminiCliOAuthCredentials } from './gemini-cli-oauth';
import { loginOpenAICodexOAuth, type OpenAICodexOAuthCredentials } from './openai-codex-oauth';
import {
  loginMiniMaxPortalOAuth,
  type MiniMaxOAuthToken,
  type MiniMaxRegion,
} from './minimax-oauth';

// Provider类型定义
export type OAuthProviderType =
  | 'google'
  | 'openai'
  | 'minimax-portal'
  | 'minimax-portal-cn';

// Provider配置常量
const PROVIDER_CONFIGS: Record<
  string,
  {
    runtimeId: string;
    defaultModel: string;
    defaultLabel: string;
    authMode: 'oauth_browser' | 'oauth_device';
  }
> = {
  google: {
    runtimeId: 'google-gemini-cli',
    defaultModel: 'gemini-3-pro-preview',
    defaultLabel: 'Google Gemini',
    authMode: 'oauth_browser',
  },
  openai: {
    runtimeId: 'openai-codex',
    defaultModel: 'gpt-5.4',
    defaultLabel: 'OpenAI Codex',
    authMode: 'oauth_browser',
  },
  'minimax-portal': {
    runtimeId: 'minimax-portal',
    defaultModel: 'claude-3-5-sonnet',
    defaultLabel: 'MiniMax (Global)',
    authMode: 'oauth_device',
  },
  'minimax-portal-cn': {
    runtimeId: 'minimax-portal',
    defaultModel: 'claude-3-5-sonnet',
    defaultLabel: 'MiniMax (CN)',
    authMode: 'oauth_device',
  },
};

// OAuth凭证类型
export type OAuthCredentials =
  | GeminiCliOAuthCredentials
  | OpenAICodexOAuthCredentials
  | MiniMaxOAuthToken;

// OAuth流程状态
interface OAuthFlowState {
  provider: OAuthProviderType | null;
  accountId: string | null;
  label: string | null;
  active: boolean;
  manualCodeResolve: ((value: string) => void) | null;
  manualCodeReject: ((reason?: unknown) => void) | null;
}

// 统一OAuth管理器
class OAuthManager extends EventEmitter {
  private state: OAuthFlowState = {
    provider: null,
    accountId: null,
    label: null,
    active: false,
    manualCodeResolve: null,
    manualCodeReject: null,
  };

  private mainWindow: BrowserWindow | null = null;

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 启动OAuth流程
   */
  async startFlow(
    provider: OAuthProviderType,
    options?: { accountId?: string; label?: string; region?: MiniMaxRegion }
  ): Promise<boolean> {
    if (this.state.active) {
      await this.stopFlow();
    }

    this.state = {
      provider,
      accountId: options?.accountId || provider,
      label: options?.label || null,
      active: true,
      manualCodeResolve: null,
      manualCodeReject: null,
    };

    this.emit('oauth:start', { provider, accountId: this.state.accountId });
    logger.info(`[OAuth] Starting flow for ${provider}`);

    try {
      if (provider === 'google' || provider === 'openai') {
        // Browser OAuth流程
        if (provider === 'openai') {
          // OpenAI可能切换到手动模式，非阻塞启动
          void this.executeBrowserFlow(provider);
          return true;
        }
        await this.executeBrowserFlow(provider);
      } else if (provider === 'minimax-portal' || provider === 'minimax-portal-cn') {
        // Device OAuth流程
        const region = provider === 'minimax-portal-cn' ? 'cn' : (options?.region || 'global');
        await this.executeDeviceFlow(provider, region);
      } else {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      return true;
    } catch (error) {
      if (!this.state.active) {
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[OAuth] Flow error for ${provider}:`, error);
      this.emitError(errorMessage);
      this.resetState();
      return false;
    }
  }

  /**
   * 停止OAuth流程
   */
  async stopFlow(): Promise<void> {
    if (this.state.manualCodeReject) {
      this.state.manualCodeReject(new Error('OAuth flow cancelled'));
    }

    this.resetState();
    logger.info('[OAuth] Flow stopped');
  }

  /**
   * 提交手动验证码
   */
  submitManualCode(code: string): boolean {
    const value = code.trim();
    if (!value || !this.state.manualCodeResolve) {
      return false;
    }

    this.state.manualCodeResolve(value);
    this.state.manualCodeResolve = null;
    this.state.manualCodeReject = null;
    return true;
  }

  /**
   * 执行Browser OAuth流程 (Google, OpenAI)
   */
  private async executeBrowserFlow(provider: 'google' | 'openai'): Promise<void> {
    const isGoogle = provider === 'google';

    const token = isGoogle
      ? await loginGeminiCliOAuth({
          isRemote: false,
          openUrl: async (url) => {
            await shell.openExternal(url);
          },
          log: (message) => logger.info(`[OAuth] ${message}`),
          note: async (message, title) => {
            logger.info(`[OAuth] ${title || 'Note'}: ${message}`);
          },
          prompt: async () => {
            throw new Error('Manual browser OAuth fallback not implemented');
          },
          progress: {
            update: (message) => logger.info(`[OAuth] ${message}`),
            stop: (message) => {
              if (message) logger.info(`[OAuth] ${message}`);
            },
          },
        })
      : await loginOpenAICodexOAuth({
          openUrl: async (url) => {
            await shell.openExternal(url);
          },
          onProgress: (message) => logger.info(`[OAuth] ${message}`),
          onManualCodeRequired: ({ authorizationUrl, reason }) => {
            const message =
              reason === 'port_in_use'
                ? 'OpenAI OAuth callback port 1455 is in use. Complete sign-in, then paste the final callback URL or code.'
                : 'OpenAI OAuth callback timed out. Paste the final callback URL or code to continue.';

            const payload = { provider, mode: 'manual' as const, authorizationUrl, message };
            this.emit('oauth:code', payload);
            this.sendToRenderer('oauth:code', payload);
          },
          onManualCodeInput: async () => {
            return new Promise<string>((resolve, reject) => {
              this.state.manualCodeResolve = resolve;
              this.state.manualCodeReject = reject;
            });
          },
        });

    await this.onSuccess(provider, token);
  }

  /**
   * 执行Device OAuth流程 (MiniMax)
   */
  private async executeDeviceFlow(
    provider: 'minimax-portal' | 'minimax-portal-cn',
    region: MiniMaxRegion
  ): Promise<void> {
    const token = await this.runWithProxyAwareFetch(() =>
      loginMiniMaxPortalOAuth({
        region,
        openUrl: async (url: string) => {
          logger.info(`[OAuth] Opening browser: ${url}`);
          shell.openExternal(url).catch((err: unknown) =>
            logger.warn(`[OAuth] Failed to open browser:`, err)
          );
        },
        note: async (message: string) => {
          if (!this.state.active) return;

          const { verificationUri, userCode } = this.parseDeviceCodeMessage(message);
          if (verificationUri && userCode) {
            this.emit('oauth:code', { provider, verificationUri, userCode, expiresIn: 300 });
            this.sendToRenderer('oauth:code', { provider, verificationUri, userCode, expiresIn: 300 });
          } else {
            logger.info(`[OAuth] Note: ${message}`);
          }
        },
        progress: {
          update: (msg: string) => logger.info(`[OAuth] Progress: ${msg}`),
          stop: (msg?: string) => logger.info(`[OAuth] Progress done: ${msg ?? ''}`),
        },
      })
    );

    if (!this.state.active) return;

    await this.onSuccess(provider, {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      resourceUrl: token.resourceUrl,
      api: 'anthropic-messages',
      region,
    });
  }

  /**
   * 使用代理感知的fetch
   */
  private async runWithProxyAwareFetch<T>(task: () => Promise<T>): Promise<T> {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: string | URL, init?: RequestInit) =>
      proxyAwareFetch(input, init)) as typeof fetch;
    try {
      return await task();
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  /**
   * 处理OAuth成功
   */
  private async onSuccess(
    provider: OAuthProviderType,
    token: OAuthCredentials & { resourceUrl?: string; api?: string; region?: MiniMaxRegion }
  ): Promise<void> {
    const { accountId, label } = this.state;
    this.resetState();

    logger.info(`[OAuth] Success for ${provider}`);

    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // 提取凭证信息
    const oauthEmail = 'email' in token && typeof token.email === 'string' ? token.email : undefined;
    const oauthSubject =
      'projectId' in token && typeof token.projectId === 'string'
        ? token.projectId
        : 'accountId' in token && typeof token.accountId === 'string'
        ? token.accountId
        : undefined;

    // 1. 保存到Provider服务 (browser OAuth)
    if (config.authMode === 'oauth_browser') {
      await this.saveBrowserProvider(provider, accountId!, label, token, config);
    }

    // 2. 保存到OpenClaw
    const tokenProviderId = provider.startsWith('minimax') ? 'minimax-portal' : provider;
    await saveOAuthTokenToOpenClaw(tokenProviderId, {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      email: oauthEmail,
      projectId: oauthSubject,
    });

    // 3. 配置MiniMax特定设置 (device OAuth)
    if (config.authMode === 'oauth_device') {
      await this.configureDeviceProvider(provider, token, config);
    }

    // 4. 发送成功事件
    this.emit('oauth:success', { provider, accountId: accountId! });
    this.sendToRenderer('oauth:success', { provider, accountId: accountId!, success: true });
  }

  /**
   * 保存Browser OAuth Provider
   */
  private async saveBrowserProvider(
    provider: OAuthProviderType,
    accountId: string,
    label: string | null,
    token: OAuthCredentials,
    config: (typeof PROVIDER_CONFIGS)['google']
  ): Promise<void> {
    const providerService = getProviderService();
    const existing = await providerService.getAccount(accountId);

    const isGoogle = provider === 'google';

    // 规范化现有模型
    const normalizedExistingModel = (() => {
      const value = existing?.model?.trim();
      if (!value) return undefined;
      if (isGoogle) {
        return value.includes('/') ? value.split('/').pop() : value;
      }
      // OpenAI OAuth使用 openai-codex/* runtime
      if (value.startsWith('openai/')) return undefined;
      if (value.startsWith('openai-codex/')) return value.split('/').pop();
      return value.includes('/') ? value.split('/').pop() : value;
    })();

    const oauthEmail = 'email' in token ? token.email : undefined;
    const oauthSubject = 'projectId' in token ? token.projectId : 'accountId' in token ? token.accountId : undefined;

    const nextAccount = await providerService.createAccount({
      id: accountId,
      vendorId: provider,
      label: label || existing?.label || config.defaultLabel,
      authMode: 'oauth_browser',
      baseUrl: existing?.baseUrl,
      apiProtocol: existing?.apiProtocol,
      model: normalizedExistingModel || config.defaultModel,
      fallbackModels: existing?.fallbackModels,
      fallbackAccountIds: existing?.fallbackAccountIds,
      enabled: existing?.enabled ?? true,
      isDefault: existing?.isDefault ?? false,
      metadata: {
        ...existing?.metadata,
        email: oauthEmail,
        resourceUrl: config.runtimeId,
      },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await getSecretStore().set({
      type: 'oauth',
      accountId,
      accessToken: token.access,
      refreshToken: token.refresh,
      expiresAt: token.expires,
      email: oauthEmail,
      subject: oauthSubject,
    });
  }

  /**
   * 配置Device OAuth Provider
   */
  private async configureDeviceProvider(
    provider: OAuthProviderType,
    token: OAuthCredentials & { resourceUrl?: string; api?: string },
    config: (typeof PROVIDER_CONFIGS)['minimax-portal']
  ): Promise<void> {
    const accountId = this.state.accountId || provider;

    // 构建baseUrl
    const defaultBaseUrl =
      provider === 'minimax-portal'
        ? 'https://api.minimax.io/anthropic'
        : 'https://api.minimaxi.com/anthropic';

    let baseUrl = token.resourceUrl || defaultBaseUrl;

    // 确保协议前缀
    if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'https://' + baseUrl;
    }

    // 确保以/anthropic结尾
    if (provider.startsWith('minimax') && baseUrl) {
      baseUrl = baseUrl.replace(/\/v1$/, '').replace(/\/anthropic$/, '').replace(/\/$/, '') + '/anthropic';
    }

    // 配置OpenClaw
    try {
      await setOpenClawDefaultModelWithOverride(config.runtimeId, undefined, {
        baseUrl,
        api: token.api || 'anthropic-messages',
        authHeader: true,
        apiKeyEnv: 'minimax-oauth',
      });
    } catch (err) {
      logger.warn(`[OAuth] Failed to configure OpenClaw:`, err);
    }

    // 保存Provider配置
    const existing = await getProvider(accountId);
    const providerConfig: ProviderConfig = {
      id: accountId,
      name: this.state.label || config.defaultLabel,
      type: provider,
      enabled: existing?.enabled ?? true,
      baseUrl,
      model: getProviderDefaultModel(provider) || existing?.model,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProvider(providerConfig);
  }

  /**
   * 解析Device Code消息
   */
  private parseDeviceCodeMessage(message: string): { verificationUri?: string; userCode?: string } {
    // 提取URL
    const urlMatch = message.match(/Open\s+(https?:\/\/\S+?)\s+to/i);
    const verificationUri = urlMatch?.[1];

    let userCode: string | undefined;

    // 从URL参数提取
    if (verificationUri) {
      try {
        const parsed = new URL(verificationUri);
        const qp = parsed.searchParams.get('user_code');
        if (qp) userCode = qp;
      } catch {
        // 忽略解析错误
      }
    }

    // 从文本提取
    if (!userCode) {
      const codeMatch = message.match(/enter.*?code\s+([A-Za-z0-9][A-Za-z0-9_-]{3,})/i);
      if (codeMatch?.[1]) userCode = codeMatch[1].replace(/\.$/, '');
    }

    return { verificationUri, userCode };
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * 发送错误事件
   */
  private emitError(message: string): void {
    this.emit('oauth:error', { message });
    this.sendToRenderer('oauth:error', { message });
  }

  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      provider: null,
      accountId: null,
      label: null,
      active: false,
      manualCodeResolve: null,
      manualCodeReject: null,
    };
  }
}

// 导出单例
export const oauthManager = new OAuthManager();

// 导出类型
export type { MiniMaxRegion, MiniMaxOAuthToken };
