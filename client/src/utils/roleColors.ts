export const getRoleColors = (role: string) => {
  const roles: Record<string, { bg: string; text: string }> = {
    admin: {
      bg: "bg-[color:var(--role-admin-bg)]",
      text: "text-[color:var(--role-admin-text)]",
    },
    pharmacist: {
      bg: "bg-[color:var(--role-pharmacist-bg)]",
      text: "text-[color:var(--role-pharmacist-text)]",
    },
    procurement_officer: {
      bg: "bg-[color:var(--role-procurement-bg)]",
      text: "text-[color:var(--role-procurement-text)]",
    },
    supplier: {
      bg: "bg-[color:var(--role-supplier-bg)]",
      text: "text-[color:var(--role-supplier-text)]",
    },
    accountant: {
      bg: "bg-[color:var(--role-accountant-bg)]",
      text: "text-[color:var(--role-accountant-text)]",
    },
  };

  return roles[role] || roles.pharmacist;
};

export const getStatusColors = (status: string) => {
  const statuses: Record<string, { bg: string; text: string }> = {
    success: {
      bg: "bg-[color:var(--status-success-bg)]",
      text: "text-[color:var(--status-success-text)]",
    },
    error: {
      bg: "bg-[color:var(--status-error-bg)]",
      text: "text-[color:var(--status-error-text)]",
    },
    warning: {
      bg: "bg-[color:var(--status-warning-bg)]",
      text: "text-[color:var(--status-warning-text)]",
    },
    info: {
      bg: "bg-[color:var(--status-info-bg)]",
      text: "text-[color:var(--status-info-text)]",
    },
  };

  return statuses[status] || statuses.info;
};

export const getActionColors = (action: string) => {
  const actions: Record<string, { bg: string; text: string }> = {
    added: {
      bg: "bg-[color:var(--action-added-bg)]",
      text: "text-[color:var(--action-added-text)]",
    },
    modified: {
      bg: "bg-[color:var(--action-modified-bg)]",
      text: "text-[color:var(--action-modified-text)]",
    },
    deleted: {
      bg: "bg-[color:var(--action-deleted-bg)]",
      text: "text-[color:var(--action-deleted-text)]",
    },
    viewed: {
      bg: "bg-[color:var(--action-viewed-bg)]",
      text: "text-[color:var(--action-viewed-text)]",
    },
    downloaded: {
      bg: "bg-[color:var(--action-downloaded-bg)]",
      text: "text-[color:var(--action-downloaded-text)]",
    },
  };

  return actions[action] || actions.modified;
};
