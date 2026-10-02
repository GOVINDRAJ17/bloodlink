"use client";

interface AuditLog {
  id: string;
  action: string;
  created_at: string;
  table_name?: string;
}

interface AdminAnalyticsProps {
  auditLogs: AuditLog[];
}

export default function AdminAnalytics({ auditLogs = [] }: AdminAnalyticsProps) {
  return (
    <div className="card-surface p-6 rounded-xl border border-[#E2E4E1] dark:border-[#2A3547] bg-white dark:bg-[#182233] shadow-sm space-y-4">
      <h2 className="font-heading text-lg font-bold text-primary-var">
        Security Audit Trail
      </h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {auditLogs.length === 0 ? (
          <p className="text-xs font-mono text-secondary-var">No audit entries logged yet.</p>
        ) : (
          auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-lg border border-gray-200 dark:border-[#2A3547] bg-[#F6F7F5] dark:bg-[#101720] text-xs font-mono"
            >
              <div className="flex items-center justify-between text-secondary-var text-[10px]">
                <span>{log.action}</span>
                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
              <strong className="text-primary-var font-bold block mt-1">
                Record: {log.table_name || "system"}
              </strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
