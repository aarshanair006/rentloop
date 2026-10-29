// Form used for BOTH adding a new item and editing an existing one.
// If the URL has an id (/edit/:id) we load that item and save changes; otherwise we create a new one.
// A live preview of the card is shown next to the form.
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, Ban } from "lucide-react";
import { callApi, CATEGORIES } from "../api.js";
import ListingCard from "../components/ListingCard.jsx";
import { LoginNeeded, EmptyState } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

function ListingForm({ user }) {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const showToast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [pricePerDay, setPricePerDay] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [city, setCity] = useState(user ? user.city : "");
  const [condition, setCondition] = useState("good");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  // When editing, fill the form with the saved item
  useEffect(() => {
    if (!isEditing || !user) {
      return;
    }
    async function loadListing() {
      try {
        const listing = await callApi("/listings/" + id);
        // The server also checks this when saving; here we just show the message early
        if (listing.owner._id !== user._id) {
          setLoadError("You can only edit your own listings.");
          setLoading(false);
          return;
        }
        setTitle(listing.title);
        setDescription(listing.description);
        setCategory(listing.category);
        setPricePerDay(String(listing.pricePerDay));
        setDeposit(String(listing.deposit));
        setCity(listing.city);
        setCondition(listing.condition);
        setImageUrl(listing.imageUrl);
        setIsActive(listing.isActive);
      } catch (err) {
        setLoadError(err.message);
      }
      setLoading(false);
    }
    loadListing();
  }, [id, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    // Same checks as the server, so the user sees the problem straight away
    let inputError = "";
    if (!title.trim()) {
      inputError = "Title is required";
    } else if (!(Number(pricePerDay) > 0)) {
      inputError = "Price per day must be more than 0";
    } else if (!(Number(deposit) >= 0)) {
      inputError = "Deposit cannot be negative";
    } else if (!/^https?:\/\//i.test(imageUrl.trim())) {
      inputError = "Image URL must start with http:// or https://";
    }
    setError(inputError);
    if (inputError) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const listingData = { title, description, category, pricePerDay, deposit, city, condition, imageUrl, isActive };
    setSaving(true);
    try {
      if (isEditing) {
        await callApi("/listings/" + id, "PUT", listingData);
        showToast("Changes saved");
      } else {
        await callApi("/listings", "POST", listingData);
        showToast("Your item is now listed");
      }
      navigate("/my-listings");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!user) {
    return <LoginNeeded text="You need an account to list items for rent." />;
  }
  if (loading) {
    return <div className="skeleton skeleton-panel" />;
  }
  if (loadError) {
    return (
      <EmptyState icon={<Ban size={24} />} title="You cannot edit this item" text={loadError}>
        <Link to="/my-listings" className="btn btn-secondary">Go to my listings</Link>
      </EmptyState>
    );
  }

  let saveLabel = "Publish listing";
  if (isEditing) {
    saveLabel = "Save changes";
  }
  if (saving) {
    saveLabel = "Saving...";
  }

  // What the card will look like on the Home page
  const previewListing = {
    _id: "preview",
    title: title || "Your item title",
    category: category,
    city: city,
    pricePerDay: pricePerDay || 0,
    deposit: deposit || 0,
    imageUrl: imageUrl,
  };

  return (
    <div>
      <Link to="/my-listings" className="back-link"><ArrowLeft size={16} /> My listings</Link>
      <div className="page-header">
        <div>
          <h1>{isEditing ? "Edit your item" : "List an item for rent"}</h1>
          <p>{isEditing ? "Changes show up on the website straight away." : "It takes about a minute. You can change everything later."}</p>
        </div>
      </div>

      <div className="form-layout">
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error mb-16"><AlertCircle size={16} /> {error}</div>}

          <div className="card form-section">
            <h3 className="mb-16">Basics</h3>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Title</label>
                <input id="title" className="input" placeholder="e.g. Canon DSLR with 18-55mm lens" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field full">
                <label htmlFor="description">Description</label>
                <textarea id="description" className="textarea" rows="3" placeholder="What is included? Anything the renter should know?" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select id="category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="condition">Condition</label>
                <select id="condition" className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
                  <option value="new">New</option>
                  <option value="good">Good</option>
                  <option value="used">Used</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card form-section">
            <h3 className="mb-16">Pricing</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="price">Price per day (₹)</label>
                <input id="price" className="input" type="number" min="1" placeholder="e.g. 500" value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="deposit">Deposit (₹)</label>
                <input id="deposit" className="input" type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                <span className="field-hint">Recorded only. Used if the item comes back damaged.</span>
              </div>
            </div>
          </div>

          <div className="card form-section">
            <h3 className="mb-16">Photo and location</h3>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="image">Image URL</label>
                <input id="image" className="input" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                <span className="field-hint">Paste a link to a photo, for example from Unsplash.</span>
              </div>
              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Link to="/my-listings" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saveLabel}</button>
          </div>
        </form>

        <aside className="sticky">
          <p className="preview-label">Live preview</p>
          <div className="preview-card">
            <ListingCard listing={previewListing} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ListingForm;
