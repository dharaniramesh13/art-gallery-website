# Kalakriti Gallery

Your single `art-gallery.html` split into separate HTML, CSS and JavaScript files, plus
signup, login and a page where signed-in users replace the artwork.

## How to run (now with a shared server)
1. Install Node.js 18 or newer from https://nodejs.org (nothing else to install, no `npm install`).
2. In this folder run:  `node server.js`
3. Open **http://localhost:3000**. Do NOT double-click `index.html` any more: the pages must be opened through the server.

The server stores everything in the `data/` folder (accounts, artworks, pictures, bids, reviews, orders), so **every laptop,
phone and visitor sees the same gallery**. Sign up or log in from any device and your artworks are there.

**Other laptops on the same Wi-Fi:** the server prints an address like `http://192.168.1.7:3000`. Open that on the other laptop.
**Anyone on the internet:** put this folder on a host that runs Node (Render, Railway, Fly.io, a VPS) and keep `data/` on a
persistent disk, otherwise the host may erase your data when it restarts. Set `TRUST_PROXY=1` behind a proxy and use HTTPS.
Back up the gallery by copying the `data/` folder.

### I already uploaded art on the old version
Those artworks are still inside the old browser. Run `migrate-old-art.html` once (see below) to copy them to the server.

## Files

    server.js         The shared backend: serves the site and stores all data in data/ (run this)
    migrate-old-art.html  One-time tool: copies artworks saved in an old browser to the server
    index.html        Home page: hero, collection with category filters, viewer, about, exhibitions, contact
    login.html        Log in (separate page)
    signup.html       Create an account (separate page)
    dashboard.html    "My art": add, edit, replace and delete artworks (needs login)

    css/base.css        Colours, fonts, buttons, navigation, forms, footer (every page)
    css/gallery.css     Home page styles
    css/auth.css        Login and signup styles
    css/dashboard.css   My art page and the add/edit dialog
    css/market.css      Buy, bid and review panels; sales lists

    js/config.js          Gallery name, email, exhibitions (edit first)
    js/artworks-data.js   The 12 SAMPLE artworks shown on first visit
    js/placeholder-art.js Draws the sample art as SVG (no image files needed)
    js/utils.js           Small helpers, image resizing, toast messages
    js/storage.js         Talks to the server: login, artworks, shared cache (KG.api, KG.auth, KG.artworks)
    js/market.js          Buy, bid and review calls to the server (the server enforces every rule)
    js/market-ui.js       The buy / bid / review panels inside the artwork viewer
    js/nav.js             Navigation: Log in / Sign up or name / My art / Log out
    js/gallery.js         Home page behaviour
    js/auth.js            Login and signup behaviour
    js/dashboard.js       My art page behaviour

## How users replace the art
1. Sign up at `signup.html` (or log in at `login.html`).
2. Open **My art**.
3. **Replace image** on any card swaps that artwork's picture for a file from the user's device.
   **Edit details** changes title, artist, category, price and so on. **Add artwork** uploads a new work.
4. Open `index.html`: the changes are already there, and category pills update automatically.

Open `index.html?category=Painting` to link straight to one category.

## Selling, bidding and reviews
- **Artists** (any signed-in user) open **My art**, choose **Add artwork** and pick *Fixed price* or *Auction*
  (starting bid and end time). They only see and edit their own works. **My sales** lists buyers and delivery details.
- **Visitors** open an artwork on the home page. Fixed price: **Buy now** (name, phone, address).
  Auction: place a bid at least about 5% above the highest one. Anyone signed in can leave one review (1 to 5 stars)
  per artwork and edit or delete it. Artists cannot buy, bid on or review their own work.
- When an auction ends, the highest bidder is recorded as the buyer and the work is marked sold.
- Checkout takes **no real payment**. Add your payment gateway inside `KG.market.buy` in `js/market.js`.

## Moving artworks that are stuck in the old browser
1. Start the server (`node server.js`).
2. On the laptop and in the browser where you first uploaded art, open `migrate-old-art.html` **the same way you used to open the old
   `index.html`** (double-click it if that is how you opened the gallery).
3. Enter the server address, the email of your old account and a password for the server (add your name if you have not signed up
   on the server yet). Press the button. Running it twice never duplicates anything.

## What the server does
- Passwords are hashed with scrypt on the server. Login gives a random token that is kept in the browser.
- Only the owner can edit or delete an artwork; bidding, buying and review rules are checked on the server.
- Bids are public but bidders' emails are not; delivery details are visible only to the seller and the buyer.
- Finished auctions are settled by the server every 30 seconds and whenever the gallery loads.
- Checkout still takes **no real payment**. Add your payment gateway in `server.js`, in the route `POST /artworks/:id/buy`.
- Storage is one JSON file plus picture files: perfect for a small gallery. For thousands of users, swap `db` in `server.js` for a database.
