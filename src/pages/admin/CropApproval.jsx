import React, { useState } from "react";
import CropVerification from "./CropVerification.jsx";
import AdminRequests from "./Requests.jsx";
import { PcicView } from "../farmer/PcicApplication.jsx";

// ONE page for everything crop-related that needs the admin's approval:
//   1) Crop Verification      — newly registered crops
//   2) Older crop change requests (only shown while some are still waiting)
export default function CropApproval() {
  const [formView, setFormView] = useState(null); // a farmer's PCIC application opened from Crop Verification

  if (formView) return <PcicView saved={formView} onBack={() => setFormView(null)} />;

  return (
    <div className="crop-approval">
      <div className="view-head">
        <h2><i className="fa-solid fa-seedling"></i> Crop Approval</h2>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Every crop a farmer registers, and every change a farmer requests from Crop Registration, lands here as <b>Pending</b>. Review it, then Verify or Reject.</p>

      <CropVerification onOpenForm={setFormView} />

      <div className="crop-approval-split" id="crop-change-requests"></div>

      <AdminRequests />
    </div>
  );
}
