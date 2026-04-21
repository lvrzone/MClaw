/**
 * PlanReviewPart - 计划审核内容块
 * 对齐 VS Code chatPlanReviewPart.ts (466行，简化版)
 */
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, FileText } from 'lucide-react';

export interface PlanStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  icon?: string;
}

export interface PlanReviewPartData {
  id: string;
  type: 'plan_review';
  title?: string;
  steps: PlanStep[];
  onApprove?: () => void;
  onReject?: () => void;
}

interface Props extends PlanReviewPartData {}

export function PlanReviewPart({ title = 'Plan Review', steps, onApprove, onReject }: Props) {
  const [expanded, setExpanded] = useState(true);

  const approvedCount = steps.filter((s) => s.status === 'approved').length;
  const rejectedCount = steps.filter((s) => s.status === 'rejected').length;

  return (
    <div className="vscode-chat-planreview-part">
      <div className="vscode-chat-planreview-header" onClick={() => setExpanded(!expanded)}>
        <span className="vscode-chat-planreview-toggle">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <FileText size={14} />
        <span className="vscode-chat-planreview-title">{title}</span>
        <span className="vscode-chat-planreview-stats">
          {approvedCount > 0 && (
            <span className="vscode-chat-planreview-approved">
              <CheckCircle2 size={11} /> {approvedCount}
            </span>
          )}
          {rejectedCount > 0 && (
            <span className="vscode-chat-planreview-rejected">
              <XCircle size={11} /> {rejectedCount}
            </span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="vscode-chat-planreview-body">
          <div className="vscode-chat-planreview-steps">
            {steps.map((step) => (
              <div key={step.id} className="vscode-chat-planreview-step" data-status={step.status}>
                <span className="vscode-chat-planreview-step-icon">
                  {step.status === 'approved' && <CheckCircle2 size={13} />}
                  {step.status === 'rejected' && <XCircle size={13} />}
                  {step.status === 'pending' && <span className="vscode-chat-planreview-step-dot" />}
                </span>
                <span className="vscode-chat-planreview-step-label">{step.label}</span>
                {step.description && (
                  <span className="vscode-chat-planreview-step-desc">{step.description}</span>
                )}
              </div>
            ))}
          </div>
          <div className="vscode-chat-planreview-actions">
            <button className="vscode-chat-planreview-approve" onClick={onApprove}>
              <CheckCircle2 size={12} /> Approve
            </button>
            <button className="vscode-chat-planreview-reject" onClick={onReject}>
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}