// Return checklist form, filled by the owner when the item comes back.
// Saving it completes the booking. The renter then agrees or disagrees with it.
import { useState } from "react";
import { PackageCheck, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";

const ONE_DAY = 24 * 60 * 60 * 1000;

// Whole days between the return deadline and today. Dates are saved at midnight UTC,
// so "today" is built the same way before subtracting.
function daysLateToday(endDate) {
  const today = new Date(new Date().toLocaleDateString("en-CA"));
  return Math.max(0, Math.round((today - new Date(endDate)) / ONE_DAY));
}

function ReturnForm({ booking, onSaved }) {
  const daysLate = daysLateToday(booking.endDate);
  const [condition, setCondition] = useState("good");
  const [missingAccessories, setMissingAccessories] = useState("");
  const [damageDescription, setDamageDescription] = useState("");
  const [damagePhotoUrl, setDamagePhotoUrl] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const amount = Number(deductionAmount);
    if (!(amount >= 0) || amount > booking.deposit) {
      setError("Deduction must be between 0 and the deposit (₹" + booking.deposit + ")");
      return;
    }
    setSaving(true);
    try {
      await callApi("/bookings/" + booking._id + "/return", "PUT", {
        condition, missingAccessories, damageDescription, damagePhotoUrl, deductionAmount: amount, notes,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="card next-step" onSubmit={handleSubmit}>
      <div className="card-title"><PackageCheck size={20} /><h3>Return checklist</h3></div>
      <p className="muted mb-16">Compare the item with the pickup checklist below. Leave the damage fields empty and the deduction at ₹0 if everything is fine.</p>
      {daysLate > 0 && (
        <div className="alert alert-warning mb-12">
          <AlertCircle size={16} /> This item is {daysLate} {daysLate === 1 ? "day" : "days"} late. The agreement's late fee is ₹{booking.listing.pricePerDay} per day (₹{daysLate * booking.listing.pricePerDay} so far). It is not added automatically.
        </div>
      )}
      {error && <div className="alert alert-error mb-12"><AlertCircle size={16} /> {error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="return-condition">Condition at return</label>
          <select id="return-condition" className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="used">Used</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="return-missing">Missing accessories</label>
          <input id="return-missing" className="input" value={missingAccessories} onChange={(e) => setMissingAccessories(e.target.value)} placeholder="Leave empty if nothing is missing" />
        </div>
        <div className="field full">
          <label htmlFor="return-damage">Damage description</label>
          <input id="return-damage" className="input" value={damageDescription} onChange={(e) => setDamageDescription(e.target.value)} placeholder="Leave empty if there is no new damage" />
        </div>
        <div className="field">
          <label htmlFor="return-photo">Damage photo URL</label>
          <input id="return-photo" className="input" value={damagePhotoUrl} onChange={(e) => setDamagePhotoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="field">
          <label htmlFor="return-deduction">Deduction from deposit (₹)</label>
          <input id="return-deduction" className="input" type="number" min="0" max={booking.deposit} value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} />
          <span className="field-hint">₹0 if no damage. At most ₹{booking.deposit}.</span>
        </div>
        <div className="field full">
          <label htmlFor="return-notes">Notes</label>
          <textarea id="return-notes" className="textarea" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save return checklist"}</button>
      </div>
    </form>
  );
}

export default ReturnForm;
