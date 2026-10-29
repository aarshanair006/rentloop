// Pickup checklist form, filled by the owner when handing over the item.
// The owner can change it until the renter clicks "I confirm this condition".
import { useState } from "react";
import { ClipboardCheck, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";

function PickupForm({ booking, onSaved }) {
  const saved = booking.pickupCheck || {};
  const [condition, setCondition] = useState(saved.condition || "good");
  const [defects, setDefects] = useState(saved.defects || "");
  const [accessories, setAccessories] = useState(saved.accessories || "");
  const [photoUrl, setPhotoUrl] = useState(saved.photoUrl || "");
  const [notes, setNotes] = useState(saved.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await callApi("/bookings/" + booking._id + "/pickup", "PUT", { condition, defects, accessories, photoUrl, notes });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <form className="card next-step" onSubmit={handleSubmit}>
      <div className="card-title"><ClipboardCheck size={20} /><h3>Pickup checklist</h3></div>
      <p className="muted mb-16">Fill this in together at handover. It is the proof of how the item looked before the rental.</p>
      {error && <div className="alert alert-error mb-12"><AlertCircle size={16} /> {error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pickup-condition">Condition at pickup</label>
          <select id="pickup-condition" className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="used">Used</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pickup-photo">Photo URL</label>
          <input id="pickup-photo" className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="field full">
          <label htmlFor="pickup-defects">Existing scratches or defects</label>
          <input id="pickup-defects" className="input" value={defects} onChange={(e) => setDefects(e.target.value)} placeholder="e.g. small scratch on the left side" />
        </div>
        <div className="field full">
          <label htmlFor="pickup-accessories">Accessories given (comma separated)</label>
          <input id="pickup-accessories" className="input" value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="e.g. charger, bag, lens cap" />
        </div>
        <div className="field full">
          <label htmlFor="pickup-notes">Notes</label>
          <textarea id="pickup-notes" className="textarea" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save pickup checklist"}</button>
      </div>
    </form>
  );
}

export default PickupForm;
