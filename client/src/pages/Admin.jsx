// Admin page: quick numbers, disputed deposits to resolve, and tables of all users and listings.
// The server checks isAdmin on every admin route; this page just shows the results.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Package, Scale, Eye, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";
import { LoginNeeded, EmptyState, Tabs, Avatar } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

// One disputed booking: both sides of the story and a form for the final decision
function DisputeCard({ booking, onResolved }) {
  const [finalDeduction, setFinalDeduction] = useState(String(booking.returnCheck.deductionAmount));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  async function resolve(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await callApi("/admin/bookings/" + booking._id + "/resolve", "POST", { finalDeduction: Number(finalDeduction), reason });
      showToast("Decision saved for \"" + booking.listing.title + "\"");
      onResolved();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <form className="card dispute-card" onSubmit={resolve}>
      <div className="card-title">
        <Scale size={20} />
        <h3>{booking.listing.title}</h3>
      </div>
      <p className="muted small">Owner: {booking.owner.name} · Renter: {booking.renter.name} · Deposit ₹{booking.deposit} (recorded only)</p>

      <div className="dispute-sides">
        <div className="dispute-side">
          <b>At pickup (confirmed by renter)</b>
          <p>Condition: {booking.pickupCheck.condition}</p>
          <p>Defects: {booking.pickupCheck.defects || "none"}</p>
          <p>Accessories: {booking.pickupCheck.accessories || "none"}</p>
        </div>
        <div className="dispute-side">
          <b>At return (owner's report)</b>
          <p>Condition: {booking.returnCheck.condition}</p>
          <p>Damage: {booking.returnCheck.damageDescription || "none"}</p>
          <p>Missing: {booking.returnCheck.missingAccessories || "none"}</p>
        </div>
      </div>
      <p>Owner asks to keep <b>₹{booking.returnCheck.deductionAmount}</b>. Renter says: "{booking.returnCheck.renterComment || "no comment"}"</p>

      {error && <div className="alert alert-error mb-12"><AlertCircle size={16} /> {error}</div>}
      <div className="dispute-form">
        <div className="field">
          <label htmlFor={"deduction-" + booking._id}>Final deduction (₹)</label>
          <input id={"deduction-" + booking._id} className="input" type="number" min="0" max={booking.deposit} value={finalDeduction} onChange={(e) => setFinalDeduction(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={"reason-" + booking._id}>Reason</label>
          <input id={"reason-" + booking._id} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Pickup checklist shows the propeller was fine" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save decision"}</button>
      </div>
    </form>
  );
}

function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("disputes");
  const showToast = useToast();

  async function loadAll() {
    setError("");
    try {
      setDisputes(await callApi("/admin/disputes"));
      setUsers(await callApi("/admin/users"));
      setListings(await callApi("/admin/listings"));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  async function deactivateListing(listing) {
    try {
      await callApi("/admin/listings/" + listing._id + "/deactivate", "PATCH");
      showToast("\"" + listing.title + "\" is now hidden from search");
      loadAll();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!user) {
    return <LoginNeeded text="Log in with an admin account to open this page." />;
  }
  if (loading) {
    return <div className="skeleton skeleton-panel" />;
  }
  // A non-admin gets "Admins only" from the server, so nothing else is shown
  if (error && users.length === 0) {
    return (
      <EmptyState icon={<ShieldAlert size={24} />} title="Admins only" text={error}>
        <Link to="/" className="btn btn-secondary">Back to browsing</Link>
      </EmptyState>
    );
  }

  const activeListingCount = listings.filter((listing) => listing.isActive).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p>Resolve deposit disputes and keep an eye on the marketplace.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-top">Users <Users size={18} /></div><b>{users.length}</b></div>
        <div className="stat"><div className="stat-top">Listings <Package size={18} /></div><b>{listings.length}</b></div>
        <div className="stat"><div className="stat-top">Active listings <Eye size={18} /></div><b>{activeListingCount}</b></div>
        <div className="stat"><div className="stat-top">Open disputes <Scale size={18} /></div><b>{disputes.length}</b></div>
      </div>

      <Tabs
        group="admin-tabs"
        active={tab}
        onChange={setTab}
        tabs={[
          { value: "disputes", label: "Disputes", count: disputes.length },
          { value: "users", label: "Users", count: users.length },
          { value: "listings", label: "Listings", count: listings.length },
        ]}
      />

      {tab === "disputes" && disputes.length === 0 && (
        <EmptyState icon={<CheckCircle2 size={24} />} title="No open disputes" text="When a renter disagrees with a return checklist, the case shows up here." />
      )}
      {tab === "disputes" && disputes.map((booking) => (
        <DisputeCard key={booking._id} booking={booking} onResolved={loadAll} />
      ))}

      {tab === "users" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>City</th><th>Role</th></tr>
            </thead>
            <tbody>
              {users.map((person) => (
                <tr key={person._id}>
                  <td><span className="table-person"><Avatar name={person.name} /> {person.name}</span></td>
                  <td>{person.email}</td>
                  <td>{person.city || "-"}</td>
                  <td>
                    {person.isAdmin && <span className="badge badge-teal">Admin</span>}
                    {!person.isAdmin && <span className="badge badge-grey">Member</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "listings" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Owner</th><th>Price / day</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing._id}>
                  <td><Link to={"/listings/" + listing._id} className="link-plain">{listing.title}</Link></td>
                  <td>{listing.owner.name}</td>
                  <td>₹{listing.pricePerDay}</td>
                  <td>
                    {listing.isActive && <span className="badge badge-dot badge-green">Active</span>}
                    {!listing.isActive && <span className="badge badge-dot badge-grey">Inactive</span>}
                  </td>
                  <td>
                    {listing.isActive && (
                      <button className="btn btn-danger-soft btn-sm" onClick={() => deactivateListing(listing)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Admin;
