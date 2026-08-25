import React from "react";
import { Check, Circle } from "lucide-react";
import StatusBadge from "./StatusBadge";

const NORMAL_ORDER = [
  "Submitted",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
];

const REJECTION_ORDER = [
  "Submitted",
  "Under Review",
  "Assigned",
  "Rejected",
];

export default function Timeline({ report }) {
  const updates = report?.updates || [];

  /*
   * ---------------------------------------------------------
   * ACTUAL REPORT STATUS
   * ---------------------------------------------------------
   */
  const isRejected =
    report?.status === "Rejected" ||
    updates.some(
      (update) => update.status === "Rejected"
    );

  /*
   * ---------------------------------------------------------
   * ONLY DISPLAY THE LIFECYCLE THAT ACTUALLY APPLIES
   * ---------------------------------------------------------
   */
  const baseOrder = isRejected
    ? REJECTION_ORDER
    : NORMAL_ORDER;

  /*
   * Find the latest update for every status.
   */
  const statusUpdates = new Map();

  updates.forEach((update) => {
    statusUpdates.set(
      update.status,
      update
    );
  });

  /*
   * ---------------------------------------------------------
   * STOP THE TIMELINE AT THE ACTUAL TERMINAL/FINAL STATUS
   * ---------------------------------------------------------
   *
   * For rejected reports:
   *
   * Submitted → Under Review → Rejected
   *
   * or
   *
   * Submitted → Under Review → Assigned → Rejected
   *
   * We don't show future statuses.
   */
  let order = baseOrder;

  if (isRejected) {
    const rejectionIndex = order.indexOf(
      "Rejected"
    );

    const rejectionUpdate =
      statusUpdates.get("Rejected");

    if (rejectionUpdate) {
      const previousStatuses = order.filter(
        (status, index) =>
          index < rejectionIndex
      );

      /*
       * Only retain statuses that actually occurred.
       */
      order = [
        ...previousStatuses.filter(
          (status) =>
            statusUpdates.has(status)
        ),
        "Rejected",
      ];
    }
  }

  return (
    <div className="timeline">
      {order.map((status) => {
        const update =
          statusUpdates.get(status);

        return (
          <div
            className={`timeline-item ${
              update ? "done" : ""
            }`}
            key={status}
          >
            <div className="timeline-dot">
              {update ? (
                <Check size={14} />
              ) : (
                <Circle size={10} />
              )}
            </div>

            <div className="timeline-content">
              <div className="timeline-head">
                <strong>{status}</strong>

                {update && (
                  <StatusBadge
                    status={status}
                  />
                )}
              </div>

              {update && (
                <>
                  <p>
                    {update.message}
                  </p>

                  <small>
                    {new Date(
                      update.createdAt
                    ).toLocaleString()}
                  </small>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
