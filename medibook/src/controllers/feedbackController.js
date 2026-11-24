//Serves the course feedback page. All text comes from the locale files in /locales.
const translations = {
  en: require('../../locales/en.json'),
  fr: require('../../locales/fr.json'),
};
const default_lang = 'en';

//Anything unsupported (de, "", ?lang=a&lang=b, __proto__ ...) falls back to English.
function pick_language(raw) {
  if (typeof raw !== 'string') {
    return default_lang;
  }
  const code = raw.trim().toLowerCase().split('-')[0];
  return Object.hasOwn(translations, code) ? code : default_lang;
}

function escape_html(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render_page(lang) {
  const t = translations[lang];
  const today = new Intl.DateTimeFormat(t.locale, { dateStyle: 'full' }).format(new Date());

  const questions = t.questions.map((question, i) => `
      <div class="question">
        <label for="q${i + 1}">${i + 1}. ${escape_html(question)}</label>
        <textarea id="q${i + 1}" name="q${i + 1}" rows="5" required></textarea>
      </div>`).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape_html(t.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .languages { text-align: right; font-size: 0.9rem; }
    .date { color: #555; }
    .question { margin-bottom: 1.5rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.4rem; }
    textarea { width: 100%; box-sizing: border-box; padding: 0.5rem; font: inherit; }
    button { padding: 0.6rem 1.2rem; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <p class="languages"><a href="/feedback?lang=en">English</a> | <a href="/feedback?lang=fr">Français</a></p>
  <h1>${escape_html(t.title)}</h1>
  <p class="date">${escape_html(t.date_label)}: ${escape_html(today)}</p>
  <p>${escape_html(t.instructions)}</p>
  <form id="feedback-form">${questions}
    <button type="submit">${escape_html(t.submit)}</button>
  </form>
  <p id="thanks" hidden>${escape_html(t.thanks)}</p>
  <script>
    document.getElementById('feedback-form').addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('thanks').hidden = false;
    });
  </script>
</body>
</html>`;
}

function show_feedback_page(req, res) {
  res.type('html').send(render_page(pick_language(req.query.lang)));
}

module.exports = { show_feedback_page, pick_language };
