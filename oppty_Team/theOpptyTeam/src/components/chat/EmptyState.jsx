import React from "react";

export default function EmptyState() {
  return (
    <div className="chatEmpty">
      <div className="emptyTitle">Select a chat</div>
      <div className="muted">Choose a conversation from the list to start messaging.</div>
    </div>
  );
}