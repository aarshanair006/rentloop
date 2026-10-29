// Home page: hero with a search bar, category chips, price and sort filters,
// and a grid of all active listings.
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, LayoutGrid, Laptop, Camera, Bike, BookOpen, Shirt, Tent, SearchX, ShieldCheck, FileSignature, ClipboardCheck } from "lucide-react";
import { callApi, CATEGORIES } from "../api.js";
import ListingCard from "../components/ListingCard.jsx";
import { Skeleton, EmptyState } from "../components/ui.jsx";

// One icon for each category chip
const CATEGORY_ICONS = {
  Electronics: Laptop,
  Cameras: Camera,
  Vehicles: Bike,
  Books: BookOpen,
  Fashion: Shirt,
  Sports: Tent,
};

// Unsplash photo ids used for the collage in the hero (a camera, a cycle and a dress)
const HERO_PHOTOS = ["1516035069371-29a1b244cc32", "1485965120184-e220f721d03e", "1595777457583-95e059d581b8"];

function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadListings() {
    setLoading(true);
    setError("");
    // Builds a query string like ?search=camera&category=Cameras&sort=priceLow
    const params = new URLSearchParams({ search, category, minPrice, maxPrice, sort });
    try {
      const data = await callApi("/listings?" + params.toString());
      setListings(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  // Category and sort apply straight away. Search text and prices apply when the form is submitted.
  // reloadCount is only there so "Clear filters" can ask for a fresh load.
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    loadListings();
  }, [category, sort, reloadCount]);

  function handleSubmit(event) {
    event.preventDefault();
    loadListings();
  }

  function clearFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCategory("");
    setSort("newest");
    setReloadCount(reloadCount + 1);
  }

  let resultText = listings.length + " items available";
  if (listings.length === 1) {
    resultText = "1 item available";
  }
  if (loading) {
    resultText = "Loading items...";
  }

  return (
    <div>
      <section className="hero">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          Rent what you need. Lend what you don't.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
          Cameras, laptops, cycles, books and party wear from people near you, for a few days at a time.
        </motion.p>
        <motion.form
          className="hero-search"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
        >
          <label className="hero-search-input">
            <Search size={18} />
            <input placeholder="What do you want to rent?" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">
            <Search size={16} /> <span>Search</span>
          </button>
        </motion.form>
        <div className="hero-points">
          <span><FileSignature size={15} /> Digital rental agreement</span>
          <span><ClipboardCheck size={15} /> Pickup and return checklists</span>
          <span><ShieldCheck size={15} /> Fair deposit disputes</span>
        </div>

        {/* Three tilted photos on the right (hidden on small screens) */}
        <div className="hero-art" aria-hidden="true">
          {HERO_PHOTOS.map((photo, index) => (
            <motion.img
              key={photo}
              src={"https://images.unsplash.com/photo-" + photo + "?w=400&q=70"}
              alt=""
              className={"hero-photo hero-photo-" + (index + 1)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.12 }}
            />
          ))}
        </div>
      </section>

      <div className="chips">
        <button className={category === "" ? "chip active" : "chip"} onClick={() => setCategory("")}>
          <LayoutGrid size={16} /> All
        </button>
        {CATEGORIES.map((name) => {
          const Icon = CATEGORY_ICONS[name];
          return (
            <button key={name} className={category === name ? "chip active" : "chip"} onClick={() => setCategory(name)}>
              <Icon size={16} /> {name}
            </button>
          );
        })}
      </div>

      <form className="toolbar" onSubmit={handleSubmit}>
        <span className="result-count">{resultText}</span>
        <input className="input price-input" type="number" min="0" placeholder="Min ₹/day" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input className="input price-input" type="number" min="0" placeholder="Max ₹/day" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <button type="submit" className="btn btn-secondary btn-sm">Apply</button>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="newest">Newest first</option>
          <option value="priceLow">Price: low to high</option>
          <option value="priceHigh">Price: high to low</option>
        </select>
      </form>

      {loading && <Skeleton count={8} type="card" />}
      {!loading && error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && listings.length === 0 && (
        <EmptyState icon={<SearchX size={24} />} title="No items match your search" text="Try another word, a different category or a wider price range.">
          <button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
        </EmptyState>
      )}
      {!loading && !error && listings.length > 0 && (
        <div className="grid">
          {listings.map((listing, index) => (
            <motion.div
              key={listing._id}
              className="full-height"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
            >
              <ListingCard listing={listing} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
