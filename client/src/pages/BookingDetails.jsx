// Booking details: a progress bar of the rental, key facts, the "what happens next" panel,
// the pickup and return checklists side by side, and the admin decision if there was a dispute.
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CalendarDays, Wallet, ShieldCheck, Users, FileText, Gavel, AlertCircle } from "lucide-react";
import { callApi, formatDate } from "../api.js";
import { LoginNeeded, EmptyState, StatusBadge, Stars } from "../components/ui.jsx";
import BookingActions from "../components/BookingActions.jsx";

// Explains the deposit in plain words
function depositText(booking) {
  if (booking.depositStatus === "refunded") {
    return "Refunded in full";
  }
  if (booking.depositStatus === "deducted") {
    // If an admin decided a dispute, their amount is the final one
    let amount = booking.returnCheck.deductionAmount;
    if (booking.adminDecision && booking.adminDecision.decidedAt) {
      amount = booking.adminDecision.finalDeduction;
    }
    return "₹" + amount + " kept, ₹" + (booking.deposit - amount) + " returned";
  }
  if (booking.depositStatus === "disputed") {
    return "Disputed, admin will decide";
  }
  if (booking.returnCheck && booking.returnCheck.recordedAt) {
    return "Waiting for renter's answer";
  }
  return "Held until return";
}

// The six stages of a rental, and whether each one is finished
function getSteps(booking, agreement) {
  const bothAccepted = Boolean(agreement && agreement.ownerAcceptedAt && agreement.renterAcceptedAt);
  return [
    { label: "Requested", done: true },
    { label: "Approved", done: ["approved", "active", "completed"].includes(booking.status) },
    { label: "Agreement", done: bothAccepted },
    { label: "Picked up", done: ["active", "completed"].includes(booking.status) },
    { label: "Returned", done: booking.status === "completed" },
    { label: "Settled", done: ["refunded", "deducted"].includes(booking.depositStatus) },
  ];
}

function BookingDetails({ user }) {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBooking() {
    try {
      const data = await callApi("/bookings/" + id);
      setInfo(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadBooking();
    }
  }, [id, user]);

  if (!user) {
    return <LoginNeeded text="Log in to see this booking." />;
  }
  if (loading) {
    return <div className="skeleton skeleton-panel" />;
  }
  if (error) {
    return (
      <EmptyState icon={<AlertCircle size={24} />} title="Could not open this booking" text={error}>
        <Link to="/my-bookings" className="btn btn-secondary">Go to my bookings</Link>
      </EmptyState>
    );
  }

  const { booking, role, agreement, review } = info;
  const pickup = booking.pickupCheck || {};
  const returned = booking.returnCheck || {};
  const pickupLocked = Boolean(pickup.renterConfirmedAt);
  const isClosed = booking.status === "rejected" || booking.status === "cancelled";
  const steps = getSteps(booking, agreement);
  // The first step that is not done yet is the "current" one
  const currentStepIndex = steps.findIndex((step) => !step.done);

  // In the return column: "-" before the return, "None" if the owner left a field empty
  let emptyReturnText = "-";
  if (returned.recordedAt) {
    emptyReturnText = "None";
  }

  let backLink = "/my-bookings";
  if (role === "owner") {
    backLink = "/requests";
  }

  return (
    <div>
      <Link to={backLink} className="back-link"><ArrowLeft size={16} /> {role === "owner" ? "Requests" : "My bookings"}</Link>

      <div className="page-header">
        <div>
          <h1>{booking.listing.title}</h1>
          <p>You are the <b>{role}</b> in this rental · <StatusBadge status={booking.status} /></p>
        </div>
        {agreement && (
          <Link className="btn btn-secondary" to={"/bookings/" + booking._id + "/agreement"}><FileText size={16} /> Rental agreement</Link>
        )}
      </div>

      {isClosed && <div className="alert alert-warning mb-16"><AlertCircle size={16} /> This request was {booking.status}. Nothing more will happen with it.</div>}

      {!isClosed && (
        <div className="steps">
          {steps.map((step, index) => {
            let className = "step";
            if (step.done) {
              className = "step done";
            } else if (index === currentStepIndex) {
              className = "step current";
            }
            return (
              <div key={step.label} className={className}>
                <div className="step-circle">{step.done ? <Check size={16} strokeWidth={3} /> : index + 1}</div>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {/* On phones the step names are hidden, so say which step we are on */}
      {!isClosed && currentStepIndex >= 0 && (
        <p className="step-caption">Step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex].label}</p>
      )}

      <div className="info-grid">
        <div className="info-tile">
          <span className="label"><CalendarDays size={14} /> Dates</span>
          <b>{formatDate(booking.startDate)} – {formatDate(booking.endDate)}</b>
          <span className="small muted">{booking.days} {booking.days === 1 ? "day" : "days"}, both ends counted</span>
        </div>
        <div className="info-tile">
          <span className="label"><Wallet size={14} /> Rent</span>
          <b>₹{booking.totalRent}</b>
          <span className="small muted">₹{booking.listing.pricePerDay} per day</span>
        </div>
        <div className="info-tile">
          <span className="label"><ShieldCheck size={14} /> Deposit (recorded only)</span>
          <b>₹{booking.deposit}</b>
          <span className="small muted">{depositText(booking)}</span>
        </div>
        <div className="info-tile">
          <span className="label"><Users size={14} /> People</span>
          <b>{booking.owner.name}</b>
          <span className="small muted">owner · renter is {booking.renter.name}</span>
        </div>
      </div>

      {!isClosed && (
        <BookingActions booking={booking} role={role} agreement={agreement} review={review} onChanged={loadBooking} />
      )}

      {pickup.recordedAt && (
        <>
          <h2 className="mt-16">Condition: pickup vs return</h2>
          <p className="muted mb-12">Anyone can see what changed between handover and return.</p>
          <div className="compare-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th></th>
                  <th>At pickup {pickupLocked && <span className="badge badge-green">Locked</span>}</th>
                  <th>At return</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Condition</td><td>{pickup.condition}</td><td>{returned.condition || "-"}</td></tr>
                <tr><td>Defects / damage</td><td>{pickup.defects || "None"}</td><td>{returned.damageDescription || emptyReturnText}</td></tr>
                <tr><td>Accessories</td><td>Given: {pickup.accessories || "None"}</td><td>Missing: {returned.missingAccessories || emptyReturnText}</td></tr>
                <tr>
                  <td>Photo</td>
                  <td>{pickup.photoUrl ? <img src={pickup.photoUrl} alt="At pickup" /> : "No photo"}</td>
                  <td>{returned.damagePhotoUrl ? <img src={returned.damagePhotoUrl} alt="At return" /> : "-"}</td>
                </tr>
                <tr><td>Notes</td><td>{pickup.notes || "-"}</td><td>{returned.notes || "-"}</td></tr>
                <tr><td>Deduction asked</td><td></td><td>{returned.recordedAt ? "₹" + returned.deductionAmount : "-"}</td></tr>
                {returned.renterResponse && (
                  <tr>
                    <td>Renter's answer</td>
                    <td></td>
                    <td><b>{returned.renterResponse === "agree" ? "Agreed" : "Disagreed"}</b>{returned.renterComment && ": \"" + returned.renterComment + "\""}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {booking.adminDecision && booking.adminDecision.decidedAt && (
        <div className="card mb-16">
          <div className="card-title"><Gavel size={20} /><h3>Admin decision</h3></div>
          <p>Final deduction: <b>₹{booking.adminDecision.finalDeduction}</b> of the ₹{booking.deposit} deposit.</p>
          <p className="muted">Reason: {booking.adminDecision.reason}</p>
        </div>
      )}

      {review && (
        <div className="card">
          <div className="card-title"><h3>Renter's review</h3><Stars rating={review.rating} /></div>
          <p className="muted">{review.comment || "No comment."}</p>
        </div>
      )}
    </div>
  );
}

export default BookingDetails;
