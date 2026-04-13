/**
 * TaskProgressDemo - 任务进度条使用示例
 * 展示四种使用场景：AI任务、文件传输、模型加载、批量处理
 */
import { useState, useEffect } from 'react';
import { TaskProgress } from './TaskProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Upload, Loader2, Files } from 'lucide-react';

export function TaskProgressDemo() {
  // 场景1: AI 执行任务进度
  const [aiStep, setAiStep] = useState(0);
  const [aiTask, setAiTask] = useState<string | null>(null);

  // 场景2: 文件上传进度
  const [uploadStep, setUploadStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // 场景3: 模型加载进度
  const [modelStep, setModelStep] = useState(0);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  // 场景4: 批量处理进度
  const [batchStep, setBatchStep] = useState(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // 模拟 AI 任务执行
  useEffect(() => {
    if (!aiTask) return;
    const interval = setInterval(() => {
      setAiStep((prev) => {
        if (prev >= 5) {
          setAiTask(null);
          return 0;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [aiTask]);

  // 模拟文件上传
  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setUploadStep((prev) => {
        if (prev >= 10) {
          setIsUploading(false);
          return 0;
        }
        return prev + 1;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [isUploading]);

  // 模拟模型加载
  useEffect(() => {
    if (!isLoadingModel) return;
    const interval = setInterval(() => {
      setModelStep((prev) => {
        if (prev >= 8) {
          setIsLoadingModel(false);
          return 0;
        }
        return prev + 1;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isLoadingModel]);

  // 模拟批量处理
  useEffect(() => {
    if (!isBatchProcessing) return;
    const interval = setInterval(() => {
      setBatchStep((prev) => {
        if (prev >= 12) {
          setIsBatchProcessing(false);
          return 0;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isBatchProcessing]);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">TaskProgress 使用示例</h2>

      {/* 场景1: AI 执行任务 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI 任务执行
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiTask && (
            <>
              <TaskProgress step={aiStep} total={5} />
              <p className="text-xs text-muted-foreground">
                {aiStep === 0 && '正在分析需求...'}
                {aiStep === 1 && '正在规划步骤...'}
                {aiStep === 2 && '正在搜索相关资料...'}
                {aiStep === 3 && '正在生成代码...'}
                {aiStep === 4 && '正在优化结果...'}
                {aiStep === 5 && '任务完成!'}
              </p>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setAiTask('code-generation');
              setAiStep(0);
            }}
            disabled={!!aiTask}
          >
            {aiTask ? '执行中...' : '开始 AI 任务'}
          </Button>
        </CardContent>
      </Card>

      {/* 场景2: 文件上传 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            文件上传
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isUploading && (
            <>
              <TaskProgress step={uploadStep} total={10} />
              <p className="text-xs text-muted-foreground">
                正在上传: document.pdf ({uploadStep * 10}%)
              </p>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setIsUploading(true);
              setUploadStep(0);
            }}
            disabled={isUploading}
          >
            {isUploading ? '上传中...' : '上传文件'}
          </Button>
        </CardContent>
      </Card>

      {/* 场景3: 模型加载 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4" />
            模型加载
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingModel && (
            <>
              <TaskProgress step={modelStep} total={8} />
              <p className="text-xs text-muted-foreground">
                {modelStep < 3 && '正在下载模型文件...'}
                {modelStep >= 3 && modelStep < 6 && '正在初始化模型...'}
                {modelStep >= 6 && '正在加载到内存...'}
              </p>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setIsLoadingModel(true);
              setModelStep(0);
            }}
            disabled={isLoadingModel}
          >
            {isLoadingModel ? '加载中...' : '加载模型'}
          </Button>
        </CardContent>
      </Card>

      {/* 场景4: 批量处理 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Files className="h-4 w-4" />
            批量文件处理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isBatchProcessing && (
            <>
              <TaskProgress step={batchStep} total={12} />
              <p className="text-xs text-muted-foreground">
                正在处理: 文件 {batchStep} / 12
              </p>
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setIsBatchProcessing(true);
              setBatchStep(0);
            }}
            disabled={isBatchProcessing}
          >
            {isBatchProcessing ? '处理中...' : '开始批量处理'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
