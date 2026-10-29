// One booking shown as a row (used on My Bookings and Requests), plus the status tabs both pages use.
import { motion } from "framer-motion";
import { CalendarDays, User, Wallet } from "lucide-react";
import { formatDate } from "../api.js";
import { StatusBadge } from "./ui.jsx";

// "personLabel" is "Owner" or "Renter", "person" is that user. "children" are the buttons on the right.
function BookingRow({ booking, personLabel, person, children }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="row-card"
    >
      <img className="row-card-image" src={booking.listing.imageUrl} alt={booking.listing.title} />
      <div className="row-card-info">
        <h3>{booking.listing.title}</h3>
        <div className="row-card-meta">
          <span><CalendarDays size={13} /> {formatDate(booking.startDate)} to {formatDate(booking.endDate)} ({booking.days} {booking.days === 1 ? "day" : "days"})</span>
          <span><User size={13} /> {personLabel}: {person.name}</span>
          <span><Wallet size={13} /> ₹{booking.totalRent} rent + ₹{booking.deposit} deposit</span>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="row-card-actions">{children}</div>
    </motion.div>
  );
}

// Which statuses belong in which tab
const TAB_STATUSES = {
  pending: ["pending"],
  upcoming: ["approved"],
  active: ["active"],
  completed: ["completed"],
  closed: ["rejected", "cancelled"],
};

export function bookingsInTab(bookings, tab) {
  if (tab === "all") {
    return bookings;
  }
  return bookings.filter((booking) => TAB_STATUSES[tab].includes(booking.status));
}

// The list of tabs with how many bookings are in each one
export function bookingTabs(bookings) {
  return [
    { value: "all", label: "All", count: bookings.length },
    { value: "pending", label: "Pending", count: bookingsInTab(bookings, "pending").length },
    { value: "upcoming", label: "Approved", count: bookingsInTab(bookings, "upcoming").length },
    { value: "active", label: "Active", count: bookingsInTab(bookings, "active").length },
    { value: "completed", label: "Completed", count: bookingsInTab(bookings, "completed").length },
    { value: "closed", label: "Closed", count: bookingsInTab(bookings, "closed").length },
  ];
}

export default BookingRow;
