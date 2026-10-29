// My Bookings page: rental requests I made as a renter, grouped by status.
// A pending request can be cancelled; later stages open the booking details.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ArrowRight, XCircle, Compass } from "lucide-react";
import { callApi } from "../api.js";
import { LoginNeeded, EmptyState, Skeleton, Tabs, ConfirmDialog } from "../components/ui.jsx";
import BookingRow, { bookingTabs, bookingsInTab } from "../components/BookingRow.jsx";
import { useToast } from "../components/Toast.jsx";

function MyBookings({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const showToast = useToast();

  async function loadBookings() {
    try {
      const data = await callApi("/bookings/mine");
      setBookings(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  async function cancelBooking() {
    const booking = bookingToCancel;
    setBookingToCancel(null);
    try {
      await callApi("/bookings/" + booking._id + "/status", "PATCH", { status: "cancelled" });
      showToast("Request for \"" + booking.listing.title + "\" cancelled");
      loadBookings();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!user) {
    return <LoginNeeded text="Log in to see the items you have rented." />;
  }

  const shownBookings = bookingsInTab(bookings, tab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My bookings</h1>
          <p>Things you have asked to rent from other people.</p>
        </div>
        <Link to="/" className="btn btn-secondary"><Compass size={16} /> Browse items</Link>
      </div>

      <Tabs group="my-booking-tabs" active={tab} onChange={setTab} tabs={bookingTabs(bookings)} />

      {loading && <Skeleton count={3} type="row" />}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && bookings.length === 0 && (
        <EmptyState icon={<CalendarCheck size={24} />} title="No bookings yet" text="Find something you need, pick your dates and send a request to the owner.">
          <Link to="/" className="btn btn-primary">Browse items</Link>
        </EmptyState>
      )}
      {!loading && !error && bookings.length > 0 && shownBookings.length === 0 && <p className="muted">Nothing in this tab.</p>}

      {shownBookings.map((booking) => (
        <BookingRow key={booking._id} booking={booking} personLabel="Owner" person={booking.owner}>
          {booking.status === "pending" && (
            <button className="btn btn-danger-soft btn-sm" onClick={() => setBookingToCancel(booking)}>
              <XCircle size={14} /> Cancel request
            </button>
          )}
          {["approved", "active", "completed"].includes(booking.status) && (
            <Link className="btn btn-primary btn-sm" to={"/bookings/" + booking._id}>View details <ArrowRight size={14} /></Link>
          )}
        </BookingRow>
      ))}

      <ConfirmDialog
        open={bookingToCancel !== null}
        title="Cancel this request?"
        message="The owner will no longer see it. You can send a new request later if the dates are still free."
        confirmLabel="Cancel request"
        onConfirm={cancelBooking}
        onCancel={() => setBookingToCancel(null)}
      />
    </div>
  );
}

export default MyBookings;
