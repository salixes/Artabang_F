import React, { useState } from "react";
import CropVerification from "./CropVerification.jsx";
import AdminRequests from "./Requests.jsx";
import { PcicView } from "../farmer/PcicApplication.jsx";

// ONE page for everything crop-related that needs the admin's approval:
//   1) Crop Verification      — newly registered crops
//   2) Crop Change Requests   — farmers asking to change their registered crops (scroll down)
export default function CropApproval() {
  const [formView, setFormView] = useState(null); // a farmer's PCIC application opened from Crop Verification

  if (formView) return <PcicView saved={formView} onBack={() => setFormView(null)} />;

  return (
    <div className="crop-approval">
      <div className="view-head">
        <h2><i className="fa-solid fa-seedling"></i> Crop Approval</h2>
        <a href="#crop-change-requests" className="link-more" onClick={(e) => { e.preventDefault(); document.getElementById("crop-change-requests")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
          Jump to Crop Change Requests <i className="fa-solid fa-arrow-down"></i>
        </a>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Approve newly registered crops first. Scroll down for the farmers' Crop Change Requests — both are on this page.</p>

      <CropVerification onOpenForm={setFormView} />

      <div className="crop-approval-split" id="crop-change-requests"></div>

      <AdminRequests />
    </div>
  );
}
