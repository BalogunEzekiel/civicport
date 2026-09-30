import React from "react";
export default function Modal({
  children,
  wide,
  adminModal = false,
  onClose,
}) {
  return (
    <div className={`modal-backdrop ${adminModal ? "admin-modal-backdrop" : ""}`}>
      <div
        className={`modal ${wide ? "modal-wide" : ""} ${
          adminModal ? "admin-modal" : ""
        }`}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        {children}
      </div>
    </div>
  );
}