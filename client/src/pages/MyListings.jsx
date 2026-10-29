// My Listings page: all items I own, with Edit, Pause/Activate and Delete.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Pencil, PauseCircle, PlayCircle, Trash2, Package, Wallet } from "lucide-react";
import { callApi } from "../api.js";
import { LoginNeeded, EmptyState, Skeleton, Tabs, ConfirmDialog } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

function MyListings({ user }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [listingToDelete, setListingToDelete] = useState(null);
  const showToast = useToast();

  async function loadListings() {
    try {
      const data = await callApi("/listings/mine");
      setListings(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadListings();
    }
  }, [user]);

  // Turns the item on or off. Inactive items are hidden from Home search.
  async function toggleActive(listing) {
    try {
      await callApi("/listings/" + listing._id, "PUT", { ...listing, isActive: !listing.isActive });
      if (listing.isActive) {
        showToast("\"" + listing.title + "\" is paused and hidden from search");
      } else {
        showToast("\"" + listing.title + "\" is live again");
      }
      loadListings();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function deleteListing() {
    const listing = listingToDelete;
    setListingToDelete(null);
    try {
      await callApi("/listings/" + listing._id, "DELETE");
      showToast("\"" + listing.title + "\" was deleted");
      loadListings();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!user) {
    return <LoginNeeded text="Log in to see and manage the items you rent out." />;
  }

  const activeCount = listings.filter((listing) => listing.isActive).length;
  const shownListings = listings.filter((listing) => {
    if (filter === "active") {
      return listing.isActive;
    }
    if (filter === "paused") {
      return !listing.isActive;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My listings</h1>
          <p>Items you rent out to other people.</p>
        </div>
        <Link to="/add" className="btn btn-primary"><Plus size={16} /> List an item</Link>
      </div>

      <Tabs
        group="listing-tabs"
        active={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "All", count: listings.length },
          { value: "active", label: "Active", count: activeCount },
          { value: "paused", label: "Paused", count: listings.length - activeCount },
        ]}
      />

      {loading && <Skeleton count={3} type="row" />}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && listings.length === 0 && (
        <EmptyState icon={<Package size={24} />} title="You have not listed anything yet" text="Earn from things you don't use every day, like a camera, a cycle or a party outfit.">
          <Link to="/add" className="btn btn-primary"><Plus size={16} /> List your first item</Link>
        </EmptyState>
      )}
      {!loading && !error && listings.length > 0 && shownListings.length === 0 && (
        <p className="muted">No items in this tab.</p>
      )}

      <AnimatePresence initial={false}>
        {shownListings.map((listing) => (
          <motion.div
            key={listing._id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="row-card"
          >
            <img className="row-card-image" src={listing.imageUrl} alt={listing.title} />
            <div className="row-card-info">
              <h3><Link to={"/listings/" + listing._id} className="link-plain">{listing.title}</Link></h3>
              <div className="row-card-meta">
                <span>₹{listing.pricePerDay} / day</span>
                <span><Wallet size={13} /> ₹{listing.deposit} deposit</span>
                <span>{listing.category}</span>
              </div>
              {listing.isActive && <span className="badge badge-dot badge-green">Active</span>}
              {!listing.isActive && <span className="badge badge-dot badge-grey">Paused</span>}
            </div>
            <div className="row-card-actions">
              <Link className="btn btn-secondary btn-sm" to={"/edit/" + listing._id}><Pencil size={14} /> Edit</Link>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(listing)}>
                {listing.isActive && <><PauseCircle size={14} /> Pause</>}
                {!listing.isActive && <><PlayCircle size={14} /> Activate</>}
              </button>
              <button className="btn btn-danger-soft btn-sm" onClick={() => setListingToDelete(listing)}><Trash2 size={14} /> Delete</button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <ConfirmDialog
        open={listingToDelete !== null}
        title="Delete this item?"
        message={listingToDelete ? "\"" + listingToDelete.title + "\" will be removed for good. If you only want to hide it for a while, use Pause instead." : ""}
        confirmLabel="Delete item"
        onConfirm={deleteListing}
        onCancel={() => setListingToDelete(null)}
      />
    </div>
  );
}

export default MyListings;
