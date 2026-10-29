// Requests page: rental requests for items I own, grouped by status, with Approve / Reject while pending.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Inbox, Check, X, ArrowRight } from "lucide-react";
import { callApi } from "../api.js";
import { LoginNeeded, EmptyState, Skeleton, Tabs } from "../components/ui.jsx";
import BookingRow, { bookingTabs, bookingsInTab } from "../components/BookingRow.jsx";
import { useToast } from "../components/Toast.jsx";

function OwnerRequests({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [busyId, setBusyId] = useState(null); // booking whose buttons are waiting for the server
  const showToast = useToast();

  async function loadRequests() {
    try {
      const data = await callApi("/bookings/requests");
      setBookings(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  // newStatus is "approved" or "rejected"
  async function changeStatus(booking, newStatus) {
    setBusyId(booking._id);
    try {
      await callApi("/bookings/" + booking._id + "/status", "PATCH", { status: newStatus });
      if (newStatus === "approved") {
        showToast("Approved. A rental agreement was created for you both to accept.");
      } else {
        showToast("Request from " + booking.renter.name + " rejected");
      }
      loadRequests();
    } catch (err) {
      // For example: another approved booking already uses these dates
      showToast(err.message, "error");
    }
    setBusyId(null);
  }

  if (!user) {
    return <LoginNeeded text="Log in to see requests for your items." />;
  }

  const shownBookings = bookingsInTab(bookings, tab);
  const pendingCount = bookingsInTab(bookings, "pending").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Requests for my items</h1>
          <p>
            {pendingCount === 0 && "You are all caught up."}
            {pendingCount > 0 && pendingCount + (pendingCount === 1 ? " request is" : " requests are") + " waiting for your answer."}
          </p>
        </div>
      </div>

      <Tabs group="request-tabs" active={tab} onChange={setTab} tabs={bookingTabs(bookings)} />

      {loading && <Skeleton count={3} type="row" />}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && bookings.length === 0 && (
        <EmptyState icon={<Inbox size={24} />} title="No requests yet" text="When someone wants to rent one of your items, their request shows up here.">
          <Link to="/my-listings" className="btn btn-secondary">See my listings</Link>
        </EmptyState>
      )}
      {!loading && !error && bookings.length > 0 && shownBookings.length === 0 && <p className="muted">Nothing in this tab.</p>}

      {shownBookings.map((booking) => (
        <BookingRow key={booking._id} booking={booking} personLabel="Renter" person={booking.renter}>
          {booking.status === "pending" && (
            <button className="btn btn-primary btn-sm" disabled={busyId === booking._id} onClick={() => changeStatus(booking, "approved")}><Check size={14} /> Approve</button>
          )}
          {booking.status === "pending" && (
            <button className="btn btn-danger-soft btn-sm" disabled={busyId === booking._id} onClick={() => changeStatus(booking, "rejected")}><X size={14} /> Reject</button>
          )}
          {["approved", "active", "completed"].includes(booking.status) && (
            <Link className="btn btn-secondary btn-sm" to={"/bookings/" + booking._id}>View details <ArrowRight size={14} /></Link>
          )}
        </BookingRow>
      ))}
    </div>
  );
}

export default OwnerRequests;
