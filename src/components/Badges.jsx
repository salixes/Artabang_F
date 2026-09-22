import React from "react";

const STATUS_CLASS = {
  Verified: "status-resolved",
  Released: "status-resolved",
  Approved: "status-resolved",
  Registered: "status-resolved",
  Active: "status-resolved",
  Claimed: "status-resolved",
  Pending: "status-pending",
  "Under Review": "status-pending",
  "Pending Review": "status-pending",
  Incoming: "status-pending",
  "New Registration": "status-pending",
  Renewal: "status-progress",
  Denied: "status-progress",
  Rejected: "status-progress",
  Expired: "status-progress",
  Cancelled: "status-progress",
};

export function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || "status-pending";
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

export function SourceBadge({ source }) {
  return <span className={`source-badge ${source === "MAO" ? "source-mao" : "source-other"}`}>{source}</span>;
}

export function InsuredBadge({ insured }) {
  return (
    <span className={`status-badge ${insured ? "status-resolved" : "status-progress"}`}>
      <i className={`fa-solid ${insured ? "fa-shield-heart" : "fa-shield-halved"}`}></i> {insured ? "Insured" : "Not Insured"}
    </span>
  );
}
