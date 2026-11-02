export const GOOD_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acme Plumbing — Emergency Plumbers in Austin, TX</title>
<meta name="description" content="Licensed emergency plumbers in Austin offering 24/7 repairs, water heater installation and drain cleaning with upfront pricing.">
<link rel="canonical" href="https://acme-plumbing.com/"><link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Acme Plumbing"><meta property="og:image" content="https://acme-plumbing.com/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Acme"}</script>
<script src="/app.js" defer></script>
</head><body>
<header><nav><a href="/">Home</a><a href="/services">Services</a><a href="/contact">Contact us</a><a href="tel:+15125550100">Call (512) 555-0100</a></nav></header>
<main>
<h1>Emergency plumbing in Austin</h1>
<p>${'We fix leaks fast and explain every step before we start the work. '.repeat(30)}</p>
<h2>Services</h2><p>${'Drain cleaning, water heaters and repiping for homes and small businesses. '.repeat(10)}</p>
<img src="/team.jpg" alt="Our plumbing team in front of the van" width="800" height="600">
<form><label for="email">Email</label><input id="email" type="email" name="email"><textarea aria-label="Message"></textarea><button>Get a quote</button></form>
</main><footer>© Acme</footer>
</body></html>`

export const BAD_HTML = `<html><head>
<meta name="robots" content="noindex, nofollow">
<script src="https://cdn.example.org/jquery.js"></script><script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script>
<meta name="viewport" content="width=device-width, user-scalable=no">
</head><body>
<div><img src="/IMG_1234.jpg"><img src="/hero.png"><img src="/x.png" alt="image"></div>
<h3>Welcome</h3><h1></h1><h1>Second</h1><h5>Deep</h5>
<form><input type="text" name="name" placeholder="Your name"><input type="email" name="email"></form>
<a href="/broken-page"><svg></svg></a><a href="/about">About</a>
<button><svg></svg></button>
<p>Short.</p>
</body></html>`
