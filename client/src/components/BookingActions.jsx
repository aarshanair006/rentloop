// The "What happens next" panel on Booking Details.
// It looks at the booking stage and who is viewing (owner or renter) and shows only the one thing to do now.
import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, Hourglass, CheckCircle2, ThumbsUp, ThumbsDown, Star, Scale, AlertCircle } from "lucide-react";
import { callApi, formatDate } from "../api.js";
import { useToast } from "./Toast.jsx";
import PickupForm from "./PickupForm.jsx";
import ReturnForm from "./ReturnForm.jsx";

// A simple panel with an icon, a title and some text (used for "waiting" messages)
function InfoPanel({ icon, title, children }) {
  return (
    <div className="card next-step">
      <div className="card-title">{icon}<h3>{title}</h3></div>
      <div className="muted">{children}</div>
    </div>
  );
}

function BookingActions({ booking, role, agreement, review, onChanged }) {
  const showToast = useToast();
  const [renterComment, setRenterComment] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [actionError, setActionError] = useState("");
  const [sending, setSending] = useState(false);

  // Used by every renter button: send the request, show a message, then reload the booking.
  // "sending" disables the buttons so a double click can't send the same answer twice.
  async function sendAction(path, body, successMessage) {
    setActionError("");
    setSending(true);
    try {
      await callApi(path, "POST", body);
      showToast(successMessage);
      onChanged();
    } catch (err) {
      setActionError(err.message);
    }
    setSending(false);
  }

  function savedChecklist(message) {
    showToast(message);
    onChanged();
  }

  const pickup = booking.pickupCheck || {};
  const returned = booking.returnCheck || {};
  const bothAccepted = agreement && agreement.ownerAcceptedAt && agreement.renterAcceptedAt;
  const pickupLocked = Boolean(pickup.renterConfirmedAt);
  let iAccepted = false;
  if (agreement && role === "owner") {
    iAccepted = Boolean(agreement.ownerAcceptedAt);
  }
  if (agreement && role === "renter") {
    iAccepted = Boolean(agreement.renterAcceptedAt);
  }
  const otherPerson = role === "owner" ? "renter" : "owner";

  const panels = [];

  // Step: agreement
  if (booking.status === "approved" && !bothAccepted && !iAccepted) {
    panels.push(
      <div key="agree" className="card next-step">
        <div className="card-title"><FileSignature size={20} /><h3>Accept the rental agreement</h3></div>
        <p className="muted">Read the terms (dates, deposit, late fee and damage rules) and accept them. Pickup can happen once you both have.</p>
        <Link className="btn btn-primary" to={"/bookings/" + booking._id + "/agreement"}>Read and accept</Link>
      </div>
    );
  }
  if (booking.status === "approved" && !bothAccepted && iAccepted) {
    panels.push(
      <InfoPanel key="agree-wait" icon={<Hourglass size={20} />} title={"Waiting for the " + otherPerson}>
        You have accepted the agreement. Pickup can happen once the {otherPerson} accepts too.
      </InfoPanel>
    );
  }

  // Step: pickup
  if (role === "owner" && bothAccepted && ["approved", "active"].includes(booking.status) && !pickupLocked) {
    panels.push(
      <div key="pickup">
        {pickup.recordedAt && (
          <div className="alert alert-info mb-12"><Hourglass size={16} /> Saved. Waiting for the renter to confirm. You can still correct it until then.</div>
        )}
        <PickupForm booking={booking} onSaved={() => savedChecklist("Pickup checklist saved. The rental is now active.")} />
      </div>
    );
  }
  if (role === "renter" && bothAccepted && !pickup.recordedAt) {
    panels.push(
      <InfoPanel key="pickup-wait" icon={<Hourglass size={20} />} title="Waiting for the handover">
        When you collect the item, the owner fills a pickup checklist. You will then confirm it here.
      </InfoPanel>
    );
  }
  if (role === "renter" && booking.status === "active" && pickup.recordedAt && !pickupLocked) {
    panels.push(
      <div key="confirm" className="card next-step">
        <div className="card-title"><CheckCircle2 size={20} /><h3>Check the item and confirm</h3></div>
        <p className="muted">Compare the item in your hands with the pickup checklist below. Confirming locks the checklist, so neither of you can change it later.</p>
        <button className="btn btn-primary" disabled={sending} onClick={() => sendAction("/bookings/" + booking._id + "/pickup/confirm", {}, "Pickup confirmed and locked")}>
          I confirm this condition
        </button>
      </div>
    );
  }

  // Step: return
  if (role === "owner" && booking.status === "active" && pickupLocked) {
    panels.push(<ReturnForm key="return" booking={booking} onSaved={() => savedChecklist("Return recorded. Waiting for the renter's answer.")} />);
  }
  if (role === "renter" && booking.status === "active" && pickupLocked) {
    panels.push(
      <InfoPanel key="return-wait" icon={<Hourglass size={20} />} title={"Return the item by " + formatDate(booking.endDate)}>
        Each late day costs one day's rent. When you hand it back, the owner records the return checklist.
      </InfoPanel>
    );
  }

  // Step: deposit answer
  if (role === "renter" && booking.status === "completed" && !returned.renterResponse) {
    panels.push(
      <div key="respond" className="card next-step">
        <div className="card-title"><Scale size={20} /><h3>Do you agree with the return checklist?</h3></div>
        <p className="muted">
          The owner asks to deduct <b>₹{returned.deductionAmount}</b> from your ₹{booking.deposit} deposit.
          If you disagree, an admin compares both checklists and decides.
        </p>
        <textarea className="textarea mb-12" rows="2" placeholder="Optional comment for the owner and admin" value={renterComment} onChange={(e) => setRenterComment(e.target.value)} />
        <div className="row-card-actions">
          <button className="btn btn-primary" disabled={sending} onClick={() => sendAction("/bookings/" + booking._id + "/return/respond", { response: "agree", comment: renterComment }, "Thanks, the deposit is settled")}>
            <ThumbsUp size={16} /> Agree
          </button>
          <button className="btn btn-danger-soft" disabled={sending} onClick={() => sendAction("/bookings/" + booking._id + "/return/respond", { response: "disagree", comment: renterComment }, "Sent to the admin to decide")}>
            <ThumbsDown size={16} /> Disagree
          </button>
        </div>
      </div>
    );
  }
  if (role === "owner" && booking.status === "completed" && !returned.renterResponse) {
    panels.push(
      <InfoPanel key="respond-wait" icon={<Hourglass size={20} />} title="Waiting for the renter's answer">
        The renter can agree with your return checklist, or disagree and ask the admin to decide.
      </InfoPanel>
    );
  }
  if (booking.depositStatus === "disputed") {
    panels.push(
      <InfoPanel key="dispute" icon={<Scale size={20} />} title="An admin is reviewing this">
        The renter disagreed with the return checklist. An admin will compare both checklists and set the final deduction.
      </InfoPanel>
    );
  }

  // Step: review (renter, once, after completion)
  if (role === "renter" && booking.status === "completed" && !review) {
    panels.push(
      <div key="review" className="card">
        <div className="card-title"><Star size={20} /><h3>How was it?</h3></div>
        <div className="star-picker" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((number) => (
            <button key={number} type="button" aria-label={number + " stars"} onClick={() => setRating(number)}>
              <Star size={28} fill={number <= rating ? "currentColor" : "none"} className={number <= rating ? "" : "star-empty"} />
            </button>
          ))}
        </div>
        <textarea className="textarea mb-12" rows="2" placeholder="Tell other renters about the item and the owner" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
        <button className="btn btn-primary" disabled={sending} onClick={() => sendAction("/reviews", { bookingId: booking._id, rating: rating, comment: reviewComment }, "Thanks for your review!")}>
          Post review
        </button>
      </div>
    );
  }

  return (
    <div className="actions-stack">
      {actionError && <div className="alert alert-error mb-12"><AlertCircle size={16} /> {actionError}</div>}
      {panels}
    </div>
  );
}

export default BookingActions;
