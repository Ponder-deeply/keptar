// Képtár static copy: lazy Instagram embeds and the artist directory filters.
;(function () {
  'use strict'

  // Instagram embeds: the fallback link stays until the post is scrolled near,
  // then the official blockquote + embed.js replaces it (as IgEmbed does live).
  var EMBED_SCRIPT = 'https://www.instagram.com/embed.js'
  var scriptLoading = false
  var pending = []

  function processEmbeds() {
    if (window.instgrm) window.instgrm.Embeds.process()
  }

  function embed(el) {
    var permalink = el.getAttribute('data-ig-permalink')
    if (!permalink) return
    var quote = document.createElement('blockquote')
    quote.className = 'instagram-media'
    quote.setAttribute('data-instgrm-permalink', permalink)
    quote.setAttribute('data-instgrm-version', '14')
    var link = el.querySelector('a')
    if (link) quote.appendChild(link)
    el.appendChild(quote)

    if (window.instgrm) return processEmbeds()
    pending.push(el)
    if (scriptLoading) return
    scriptLoading = true
    var script = document.createElement('script')
    script.src = EMBED_SCRIPT
    script.async = true
    script.onload = processEmbeds
    document.body.appendChild(script)
  }

  var embeds = document.querySelectorAll('[data-ig-permalink]')
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return
          observer.unobserve(entry.target)
          embed(entry.target)
        })
      },
      { rootMargin: '400px 0px' },
    )
    embeds.forEach(function (el) {
      observer.observe(el)
    })
  } else {
    embeds.forEach(embed)
  }

  // Directory filters: medium and region, matched against the cards' data attributes.
  var form = document.querySelector('[data-artist-filters]')
  if (!form) return
  var cards = document.querySelectorAll('.artist-card')
  var empty = document.querySelector('[data-artist-empty]')
  form.hidden = false

  function applyFilters() {
    var medium = form.elements.medium.value
    var region = form.elements.region.value
    var shown = 0
    cards.forEach(function (card) {
      var mediums = (card.getAttribute('data-medium') || '').split('|')
      var match =
        (!medium || mediums.indexOf(medium) !== -1) && (!region || card.getAttribute('data-region') === region)
      card.hidden = !match
      if (match) shown++
    })
    if (empty) empty.hidden = shown > 0
  }

  form.addEventListener('change', applyFilters)
})()
