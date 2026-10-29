// One item card in the listing grid: photo, category, title, city and price.
// Clicking it opens the details page. It lifts up a little on hover.
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ImageIcon } from "lucide-react";

function ListingCard({ listing }) {
  return (
    <motion.div className="full-height" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link to={"/listings/" + listing._id} className="listing-card">
        <div className="listing-card-image">
          {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} loading="lazy" />}
          {!listing.imageUrl && <div className="image-placeholder"><ImageIcon size={32} /></div>}
          <span className="badge">{listing.category}</span>
        </div>
        <div className="listing-card-body">
          <h3>{listing.title}</h3>
          <div className="listing-card-meta">
            <MapPin size={14} /> {listing.city || "City not given"}
          </div>
          <div className="listing-card-price">
            <span className="price">₹{listing.pricePerDay} <small>/ day</small></span>
            <span className="small muted">₹{listing.deposit} deposit</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default ListingCard;
