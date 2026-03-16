export interface Product {
  id: number;
  name: string;
  category: "Catering Packages" | "Packaged Meals" | "À La Carte" | "Frozen Meals";
  price: number;
  unit: string;
  image: string;
  imageAlt: string;
  tags: string[];
  rating: number;
  reviews: number;
  description: string;
  minOrder?: number;
  badge?: string;
  available: boolean;
}

export const products: Product[] = [
// CATERING PACKAGES
{
  id: 1,
  name: "Classic American BBQ Package",
  category: "Catering Packages",
  price: 38,
  unit: "per head",
  image: "https://images.unsplash.com/photo-1503591099259-a96e250e0a67",
  imageAlt: "Rustic BBQ spread with pulled pork, ribs, corn, and coleslaw on a wooden table",
  tags: ["Crowd Pleaser", "Outdoor"],
  rating: 4.8,
  reviews: 142,
  description: "Slow-smoked pulled pork, BBQ ribs, grilled corn, coleslaw, and cornbread. Minimum 30 guests.",
  minOrder: 30,
  badge: "Best Seller",
  available: true
},
{
  id: 2,
  name: "Elegant Plated Dinner",
  category: "Catering Packages",
  price: 72,
  unit: "per head",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ae47ed17-1770910631396.png",
  imageAlt: "Elegant white-tablecloth dinner service with beautifully plated fine dining dishes",
  tags: ["Fine Dining", "Wedding"],
  rating: 5.0,
  reviews: 87,
  description: "Three-course plated dinner with amuse-bouche, choice of entrée, and dessert. Staff included.",
  minOrder: 20,
  badge: "Premium",
  available: true
},
{
  id: 3,
  name: "Mediterranean Buffet",
  category: "Catering Packages",
  price: 45,
  unit: "per head",
  image: "https://images.unsplash.com/photo-1594040815648-9251e9baabc8",
  imageAlt: "Abundant Mediterranean buffet spread with hummus, grilled meats, salads, and pita",
  tags: ["Vegetarian Friendly", "Buffet"],
  rating: 4.9,
  reviews: 203,
  description: "Mezze station, grilled meats, roasted vegetables, couscous, and baklava dessert.",
  minOrder: 25,
  available: true
},
{
  id: 4,
  name: "Corporate Lunch Box",
  category: "Catering Packages",
  price: 18,
  unit: "per box",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_16f93dc07-1768376307777.png",
  imageAlt: "Neatly arranged corporate lunch boxes with fresh salads and sandwiches",
  tags: ["Corporate", "Individual"],
  rating: 4.7,
  reviews: 318,
  description: "Gourmet sandwich or wrap, seasonal salad, fresh fruit, and a cookie. Minimum 10 boxes.",
  minOrder: 10,
  available: true
},
// PACKAGED MEALS
{
  id: 5,
  name: "Herb-Roasted Chicken & Vegetables",
  category: "Packaged Meals",
  price: 14,
  unit: "per serving",
  image: "https://images.unsplash.com/photo-1518492104633-130d0cc84637",
  imageAlt: "Golden herb-roasted chicken thighs with colorful roasted vegetables in a cast iron pan",
  tags: ["High Protein", "Gluten-Free"],
  rating: 4.9,
  reviews: 445,
  description: "Free-range chicken thighs roasted with rosemary, garlic, and seasonal root vegetables.",
  badge: "Weekly Pick",
  available: true
},
{
  id: 6,
  name: "Truffle Mushroom Risotto",
  category: "Packaged Meals",
  price: 16,
  unit: "per serving",
  image: "https://images.unsplash.com/photo-1724116380653-a5371c60944a",
  imageAlt: "Creamy truffle mushroom risotto with parmesan shavings and fresh thyme garnish",
  tags: ["Vegetarian", "Comfort"],
  rating: 4.8,
  reviews: 520,
  description: "Arborio rice slow-cooked with wild mushrooms, truffle oil, and aged Parmigiano-Reggiano.",
  available: true
},
{
  id: 7,
  name: "Teriyaki Salmon Bowl",
  category: "Packaged Meals",
  price: 18,
  unit: "per serving",
  image: "https://images.unsplash.com/photo-1516701864306-96b7ebae2d9f",
  imageAlt: "Teriyaki glazed salmon fillet over brown rice with edamame and pickled ginger",
  tags: ["Omega-3", "Low Carb Option"],
  rating: 4.9,
  reviews: 387,
  description: "Atlantic salmon in house teriyaki glaze, brown rice, edamame, pickled ginger, sesame.",
  available: true
},
{
  id: 8,
  name: "Braised Short Rib & Mash",
  category: "Packaged Meals",
  price: 22,
  unit: "per serving",
  image: "https://images.unsplash.com/photo-1681830696268-4b4a55b1f427",
  imageAlt: "Fall-off-the-bone braised short rib over creamy mashed potatoes with red wine jus",
  tags: ["High Protein", "Comfort"],
  rating: 5.0,
  reviews: 298,
  description: "48-hour braised beef short rib, truffle mashed potatoes, red wine reduction, gremolata.",
  badge: "Chef's Pick",
  available: true
},
{
  id: 9,
  name: "Thai Green Curry",
  category: "Packaged Meals",
  price: 13,
  unit: "per serving",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1158bf432-1765352762715.png",
  imageAlt: "Fragrant Thai green curry with vegetables in coconut milk served with jasmine rice",
  tags: ["Vegan", "Spicy"],
  rating: 4.7,
  reviews: 412,
  description: "House-made green curry paste, coconut milk, seasonal vegetables, jasmine rice, Thai basil.",
  available: true
},
// À LA CARTE
{
  id: 10,
  name: "Charcuterie & Cheese Board",
  category: "À La Carte",
  price: 65,
  unit: "per board (serves 8–10)",
  image: "https://images.unsplash.com/photo-1664668686853-b78b12bd9e26",
  imageAlt: "Artisan charcuterie board with cured meats, aged cheeses, crackers, and fresh fruit",
  tags: ["Entertaining", "Crowd Favorite"],
  rating: 4.9,
  reviews: 567,
  description: "Curated selection of 4 artisan cheeses, 3 cured meats, seasonal fruit, nuts, and house crackers.",
  badge: "Most Ordered",
  available: true
},
{
  id: 11,
  name: "Seasonal Salad Platter",
  category: "À La Carte",
  price: 42,
  unit: "per platter (serves 6–8)",
  image: "https://images.unsplash.com/photo-1611171711925-92171c63fc4b",
  imageAlt: "Colorful seasonal salad platter with mixed greens, roasted beets, and goat cheese",
  tags: ["Vegan Option", "Fresh"],
  rating: 4.7,
  reviews: 189,
  description: "Market greens, roasted beets, candied walnuts, goat cheese, house vinaigrette on the side.",
  available: true
},
{
  id: 12,
  name: "Dessert Petit Fours",
  category: "À La Carte",
  price: 48,
  unit: "per dozen",
  image: "https://images.unsplash.com/photo-1733133114174-ee77bf736e88",
  imageAlt: "Elegant assortment of colorful petit fours and French pastries on a white cake stand",
  tags: ["Sweet", "Elegant"],
  rating: 4.8,
  reviews: 234,
  description: "Rotating seasonal selection of 4 varieties: macarons, chocolate truffles, lemon tartlets, éclairs.",
  available: true
},
// FROZEN MEALS
{
  id: 13,
  name: "Frozen Butter Chicken",
  category: "Frozen Meals",
  price: 12,
  unit: "per serving",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_164c8876a-1767907270676.png",
  imageAlt: "Rich and creamy frozen butter chicken in a takeaway container ready to heat",
  tags: ["Gluten-Free", "High Protein"],
  rating: 4.8,
  reviews: 210,
  description: "Tender chicken in a velvety tomato-cream sauce. Heat from frozen in 8 minutes. Serves 1–2.",
  badge: "New",
  available: true
},
{
  id: 14,
  name: "Frozen Beef Lasagne",
  category: "Frozen Meals",
  price: 14,
  unit: "per serving",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1378a0833-1765319149066.png",
  imageAlt: "Layers of pasta, rich beef bolognese, and béchamel in a frozen lasagne portion",
  tags: ["Comfort", "Family Favourite"],
  rating: 4.7,
  reviews: 178,
  description: "Classic beef bolognese layered with fresh pasta sheets and creamy béchamel. Oven-ready from frozen.",
  available: true
},
{
  id: 15,
  name: "Frozen Vegetable Curry",
  category: "Frozen Meals",
  price: 11,
  unit: "per serving",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13d75fbfc-1767907266450.png",
  imageAlt: "Vibrant frozen vegetable curry with chickpeas and spinach in a rich tomato sauce",
  tags: ["Vegan", "Gluten-Free"],
  rating: 4.6,
  reviews: 143,
  description: "Chickpeas, spinach, and seasonal vegetables in a fragrant tomato-coconut curry. Heat in 6 minutes.",
  available: true
},
{
  id: 16,
  name: "Frozen Mac & Cheese",
  category: "Frozen Meals",
  price: 10,
  unit: "per serving",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1beb1562f-1772222748789.png",
  imageAlt: "Golden baked mac and cheese with a crispy breadcrumb topping in a frozen portion",
  tags: ["Vegetarian", "Comfort"],
  rating: 4.9,
  reviews: 325,
  description: "Three-cheese blend with a golden breadcrumb crust. Bake from frozen for a crispy top.",
  badge: "Best Seller",
  available: true
}];


export const categories = ["All", "Catering Packages", "Packaged Meals", "À La Carte", "Frozen Meals"] as const;
export type Category = (typeof categories)[number];