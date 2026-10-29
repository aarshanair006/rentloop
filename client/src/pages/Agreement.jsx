// Rental agreement page: shows the fixed terms like a document, and an "I agree" button
// for the owner and the renter. Pickup cannot happen until both have accepted.
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle2, Clock, Info, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";
import { LoginNeeded, EmptyState } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

// Shows a saved time like "25 Oct 2026, 18:30" in the user's own time zone
function formatTime(dateValue) {
  return new Date(dateValue).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// One signature box: who it is for, and whether they have accepted
function Signature({ title, acceptedAt }) {
  return (
    <div className={acceptedAt ? "signature signed" : "signature"}>
      <b>{title}</b>
      {acceptedAt && <div className="signature-status"><CheckCircle2 size={16} /> Accepted on {formatTime(acceptedAt)}</div>}
      {!acceptedAt && <div className="signature-status muted"><Clock size={16} /> Not accepted yet</div>}
    </div>
  );
}

function Agreement({ user }) {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const showToast = useToast();

  async function loadAgreement() {
    try {
      const data = await callApi("/agreements/" + id);
      setInfo(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadAgreement();
    }
  }, [id, user]);

  async function acceptAgreement() {
    setAccepting(true);
    try {
      await callApi("/agreements/" + id + "/accept", "POST");
      showToast("You accepted the agreement");
      loadAgreement();
    } catch (err) {
      showToast(err.message, "error");
    }
    setAccepting(false);
  }

  if (!user) {
    return <LoginNeeded text="Log in to see this agreement." />;
  }
  if (loading) {
    return <div className="skeleton skeleton-panel" />;
  }
  if (error) {
    return (
      <EmptyState icon={<AlertCircle size={24} />} title="No agreement to show" text={error}>
        <Link to={"/bookings/" + id} className="btn btn-secondary">Back to the booking</Link>
      </EmptyState>
    );
  }

  const { agreement, booking, role } = info;
  let myAcceptTime = agreement.renterAcceptedAt;
  if (role === "owner") {
    myAcceptTime = agreement.ownerAcceptedAt;
  }
  const bothAccepted = agreement.ownerAcceptedAt && agreement.renterAcceptedAt;
  // The terms are saved as one text with a line per rule, so we show each line as a list item
  const termLines = agreement.termsText.split("\n");

  return (
    <div className="agreement">
      <Link to={"/bookings/" + booking._id} className="back-link"><ArrowLeft size={16} /> Back to the booking</Link>

      <div className="card document">
        <div className="document-head">
          <span className="empty-icon"><FileText size={24} /></span>
          <div>
            <h1>Rental agreement</h1>
            <p className="muted">{booking.listing.title} · you are the {role}</p>
          </div>
        </div>

        <ol className="terms">
          {termLines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>

        <div className="signatures">
          <Signature title="Owner" acceptedAt={agreement.ownerAcceptedAt} />
          <Signature title="Renter" acceptedAt={agreement.renterAcceptedAt} />
        </div>

        {!myAcceptTime && (
          <button className="btn btn-primary btn-lg btn-block mt-16" onClick={acceptAgreement} disabled={accepting}>
            {accepting ? "Saving..." : "I agree to these terms"}
          </button>
        )}
        {bothAccepted && (
          <div className="alert alert-success mt-16"><CheckCircle2 size={16} /> Both of you have accepted. The item can now be picked up.</div>
        )}

        <p className="field-hint mt-16">
          <Info size={12} /> This is a simple digital acceptance for a student project, not a legally verified signature.
          The terms cannot be changed after the booking is approved.
        </p>
      </div>
    </div>
  );
}

export default Agreement;
