// Listing details page: photo, full info, owner and reviews on the left,
// and the booking box (dates + live price breakdown + "Request to Rent") on the right.
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Tag, Sparkles, CalendarDays, Info, Pencil, Inbox, MessageSquare, AlertCircle } from "lucide-react";
import { callApi, formatDate } from "../api.js";
import { Avatar, Stars, EmptyState } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

const ONE_DAY = 24 * 60 * 60 * 1000;

function ListingDetails({ user }) {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [reviewInfo, setReviewInfo] = useState({ reviews: [], averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadListing() {
      try {
        const data = await callApi("/listings/" + id);
        setListing(data);
        const reviewData = await callApi("/reviews/listing/" + id);
        setReviewInfo(reviewData);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    loadListing();
  }, [id]);

  if (loading) {
    return (
      <div className="details-layout">
        <div className="skeleton details-image" />
        <div className="skeleton skeleton-panel" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState icon={<AlertCircle size={24} />} title="Could not open this item" text={error}>
        <Link to="/" className="btn btn-secondary">Back to browsing</Link>
      </EmptyState>
    );
  }

  const isOwner = user && user._id === listing.owner._id;

  return (
    <div>
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to browsing</Link>

      <div className="details-layout">
        <div>
          <img className="details-image" src={listing.imageUrl} alt={listing.title} />
          <h1 className="details-title">{listing.title}</h1>
          <div className="meta-row">
            <span className="badge badge-grey"><Tag size={13} /> {listing.category}</span>
            <span className="badge badge-grey"><Sparkles size={13} /> Condition: {listing.condition}</span>
            <span className="badge badge-grey"><MapPin size={13} /> {listing.city || "City not given"}</span>
            {!listing.isActive && <span className="badge badge-red">Not available right now</span>}
          </div>

          <div className="section">
            <h2>About this item</h2>
            <p className="muted">{listing.description || "The owner has not added a description."}</p>
          </div>

          <div className="section">
            <div className="owner-row">
              <Avatar name={listing.owner.name} large />
              <div>
                <b>Listed by {listing.owner.name}</b>
                <p className="small muted">{listing.owner.city}</p>
              </div>
            </div>
          </div>

          <div className="section">
            <h2>Reviews</h2>
            {reviewInfo.reviews.length === 0 && <p className="muted">No reviews yet. Reviews appear after a completed rental.</p>}
            {reviewInfo.reviews.length > 0 && (
              <div className="rating-summary">
                <b>{reviewInfo.averageRating}</b>
                <Stars rating={reviewInfo.averageRating} size={18} />
                <span className="muted small">from {reviewInfo.reviews.length} {reviewInfo.reviews.length === 1 ? "review" : "reviews"}</span>
              </div>
            )}
            {reviewInfo.reviews.map((review) => (
              <div key={review._id} className="review">
                <Avatar name={review.reviewer.name} />
                <div>
                  <div className="review-head">
                    <b>{review.reviewer.name}</b>
                    <Stars rating={review.rating} size={13} />
                    <span className="small muted">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="muted">{review.comment}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="sticky">
          {isOwner && <OwnerBox listing={listing} />}
          {!isOwner && <BookingBox listing={listing} user={user} />}
        </aside>
      </div>
    </div>
  );
}

// What the owner sees instead of the booking box
function OwnerBox({ listing }) {
  return (
    <div className="card booking-card">
      <span className="price">₹{listing.pricePerDay} <small>/ day</small></span>
      <div className="alert alert-info my-16">
        <Info size={16} /> This is your listing, so you cannot rent it yourself.
      </div>
      <div className="form-stack">
        <Link className="btn btn-primary btn-block" to={"/edit/" + listing._id}><Pencil size={16} /> Edit this item</Link>
        <Link className="btn btn-secondary btn-block" to="/requests"><Inbox size={16} /> See rental requests</Link>
      </div>
    </div>
  );
}

// Date picker, live price breakdown and the "Request to Rent" button
function BookingBox({ listing, user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestError, setRequestError] = useState("");
  const [sending, setSending] = useState(false);

  async function requestToRent() {
    setRequestError("");
    setSending(true);
    try {
      await callApi("/bookings", "POST", { listingId: listing._id, startDate, endDate });
      showToast("Request sent to " + listing.owner.name);
      navigate("/my-bookings");
    } catch (err) {
      setRequestError(err.message);
      setSending(false);
    }
  }

  const today = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD"
  const datesWrong = startDate && endDate && endDate < startDate;

  // Days rule: both the start day and the end day are counted
  let days = 0;
  if (startDate && endDate && !datesWrong) {
    days = Math.round((new Date(endDate) - new Date(startDate)) / ONE_DAY) + 1;
  }
  const rent = days * listing.pricePerDay;

  return (
    <div className="card booking-card">
      <span className="price">₹{listing.pricePerDay} <small>/ day</small></span>

      {!listing.isActive && (
        <div className="alert alert-warning mt-16">
          <Info size={16} /> The owner has paused this item, so it cannot be booked right now.
        </div>
      )}

      {listing.isActive && (
        <>
          <div className="date-row">
            <div className="field">
              <label htmlFor="start-date">Start date</label>
              <input id="start-date" className="input" type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="end-date">End date</label>
              <input id="end-date" className="input" type="date" min={startDate || today} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="field-hint"><CalendarDays size={12} /> Both the start and end day are counted, so 1st to 3rd is 3 days.</p>

          {datesWrong && <div className="alert alert-error"><AlertCircle size={16} /> End date cannot be before start date</div>}

          <div className="breakdown">
            <div className="breakdown-row">
              <span>₹{listing.pricePerDay} × {days} {days === 1 ? "day" : "days"}</span>
              <span>₹{rent}</span>
            </div>
            <div className="breakdown-row">
              <span>Deposit (recorded only, no real payment)</span>
              <span>₹{listing.deposit}</span>
            </div>
            <div className="breakdown-row breakdown-total">
              <span>Total</span>
              <span>₹{rent + listing.deposit}</span>
            </div>
          </div>

          {requestError && <div className="alert alert-error mb-12"><AlertCircle size={16} /> {requestError}</div>}

          {user && (
            <button className="btn btn-primary btn-lg btn-block" onClick={requestToRent} disabled={days === 0 || sending}>
              {sending ? "Sending request..." : "Request to Rent"}
            </button>
          )}
          {!user && <Link className="btn btn-primary btn-lg btn-block" to="/login">Log in to request</Link>}
          <p className="field-hint text-center mt-12">
            <MessageSquare size={12} /> You will not be charged. The owner approves first.
          </p>
        </>
      )}
    </div>
  );
}

export default ListingDetails;
