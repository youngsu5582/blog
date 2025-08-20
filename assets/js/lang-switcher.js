function switchLanguage(isChecked, pageUrl, defaultLang) {
  let targetLang;
  if (isChecked) {
    // Checkbox is checked, so switch to English (EN)
    targetLang = "en";
  } else {
    // Checkbox is unchecked, so switch to Korean (KO)
    targetLang = "ko";
  }

  let newUrl;
  if (targetLang === defaultLang) {
    // If target is default language, remove language prefix
    newUrl = pageUrl.replace(`/${defaultLang}`, '');
  } else {
    // If target is not default language, add language prefix
    if (pageUrl.startsWith(`/${defaultLang}`)) {
      newUrl = pageUrl.replace(`/${defaultLang}`, `/${targetLang}`);
    } else {
      newUrl = `/${targetLang}${pageUrl}`;
    }
  }

  // Handle root path for default language
  if (newUrl === '' && targetLang === defaultLang) {
    newUrl = '/';
  }

  window.location.href = newUrl;
}