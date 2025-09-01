import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { q, source = "auto", target } = req.body || {};
  if (!q || !target) {
    return res.status(400).json({ error: "q and target are required" });
  }

  // If source equals target, nothing to translate
  if (source !== 'auto' && source.toLowerCase() === target.toLowerCase()) {
    return res.status(200).json({ translatedText: q });
  }

  // Special handling for transliterated Hindi text
  // If source is Hindi but text is in English letters, try translating as English first
  if (source === 'hi' && /^[a-zA-Z\s\.,!?]+$/.test(q)) {
    try {
      const englishSourceUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(q)}`;
      const response = await axios.get(englishSourceUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.data && response.data[0] && response.data[0][0]) {
        const translatedText = response.data[0][0][0];
        if (translatedText && translatedText !== q) {
          return res.status(200).json({ translatedText });
        }
      }
    } catch (error) {
      // Continue to next service
    }
  }

  // Service 1: Google Translate (via public proxy)
  try {
    const googleTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source === 'auto' ? 'auto' : source}&tl=${target}&dt=t&q=${encodeURIComponent(q)}`;
    
    const response = await axios.get(googleTranslateUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response.data && response.data[0] && response.data[0][0]) {
      const translatedText = response.data[0][0][0];
      if (translatedText && translatedText !== q) {
        return res.status(200).json({ translatedText });
      }
    }
    
    // Check if Google Translate returned an error message
    if (response.data && typeof response.data === 'string' && response.data.includes('distinct languages')) {
      throw new Error('Google Translate rejected language pair');
    }
    
  } catch (error) {
    // Continue to next service
  }

  // Service 2: MyMemory (public, reliable)
  try {
    // For MyMemory, we need to specify a source language, so use 'en' as default for auto
    const src = (source === 'auto') ? 'en' : source;
    const pair = `${src}|${target}`.toLowerCase();
    
    const response = await axios.get("https://api.mymemory.translated.net/get", {
      params: { 
        q, 
        langpair: pair 
      }, 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.data?.responseData?.translatedText) {
      const translatedText = response.data.responseData.translatedText;
      return res.status(200).json({ translatedText });
    } else if (response.data?.responseDetails) {
      // Check if the error message contains the problematic text
      if (response.data.responseDetails.includes('distinct languages')) {
        // Try with a different source language if auto-detection fails
        if (src === 'en') {
          // Try with Spanish as source if English fails
          const altPair = `es|${target}`;
          const altResponse = await axios.get("https://api.mymemory.translated.net/get", {
            params: { q, langpair: altPair }, 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (altResponse.data?.responseData?.translatedText) {
            const translatedText = altResponse.data.responseData.translatedText;
            return res.status(200).json({ translatedText });
          }
        }
      }
    }
  } catch (error) {
    // Continue to next service
  }

  // Service 3: LibreTranslate (public instances)
  const libreTranslateUrls = [
    "https://libretranslate.de/translate",
    "https://translate.astian.org/translate",
    "https://translate.argosopentech.com/translate"
  ];

  for (const url of libreTranslateUrls) {
    try {
      const response = await axios.post(
        url,
        { 
          q, 
          source: source === 'auto' ? 'auto' : source, 
          target: target, 
          format: "text" 
        },
        { 
          headers: { "Content-Type": "application/json" }, 
          timeout: 10000 
        }
      );
      
      if (response.data?.translatedText) {
        const translatedText = response.data.translatedText;
        return res.status(200).json({ translatedText });
      }
    } catch (error) {
      // Continue to next service
    }
  }

  // Service 4: Lingva (Google Translate proxy)
  const lingvaHosts = [
    "https://lingva.ml",
    "https://lingva.garudalinux.org",
    "https://lingva.pussthecat.org"
  ];

  for (const host of lingvaHosts) {
    try {
      const src = (source === 'auto') ? 'auto' : source;
      const url = `${host}/api/v1/${encodeURIComponent(src)}/${encodeURIComponent(target)}/${encodeURIComponent(q)}`;
      
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data?.translation) {
        const translatedText = response.data.translation;
        return res.status(200).json({ translatedText });
      }
    } catch (error) {
      // Continue to next service
    }
  }

  // Service 5: Simple fallback translation (basic word replacement for common phrases)
  try {
    const basicTranslations = {
      'en': {
        'es': { 
          'hello': 'hola', 'hi': 'hola', 'how are you': 'cómo estás', 'goodbye': 'adiós', 'thank you': 'gracias',
          'good morning': 'buenos días', 'good afternoon': 'buenas tardes', 'good night': 'buenas noches',
          'yes': 'sí', 'no': 'no', 'please': 'por favor', 'sorry': 'lo siento', 'excuse me': 'perdón'
        },
        'fr': { 
          'hello': 'bonjour', 'hi': 'salut', 'how are you': 'comment allez-vous', 'goodbye': 'au revoir', 'thank you': 'merci',
          'good morning': 'bonjour', 'good afternoon': 'bon après-midi', 'good night': 'bonne nuit',
          'yes': 'oui', 'no': 'non', 'please': 's\'il vous plaît', 'sorry': 'désolé', 'excuse me': 'excusez-moi'
        },
        'de': { 
          'hello': 'hallo', 'hi': 'hallo', 'how are you': 'wie geht es dir', 'goodbye': 'auf wiedersehen', 'thank you': 'danke',
          'good morning': 'guten morgen', 'good afternoon': 'guten tag', 'good night': 'gute nacht',
          'yes': 'ja', 'no': 'nein', 'please': 'bitte', 'sorry': 'entschuldigung', 'excuse me': 'entschuldigung'
        }
      },
      'hi': {
        'en': {
          'namaste': 'hello', 'kaise': 'how', 'ho': 'are', 'aap': 'you', 'kya': 'what', 'hai': 'is',
          'main': 'i', 'tum': 'you', 'mera': 'my', 'tera': 'your', 'kahan': 'where', 'kaun': 'who',
          'kyun': 'why', 'kab': 'when', 'kaisa': 'how', 'dhanyavaad': 'thank you', 'shukriya': 'thanks',
          'aapka': 'your', 'aapki': 'your', 'hamara': 'our', 'hamari': 'our', 'sabse': 'most',
          'bahut': 'very', 'accha': 'good', 'bura': 'bad', 'naya': 'new', 'purana': 'old',
          'chota': 'small', 'bada': 'big', 'dekhna': 'see', 'sunna': 'hear', 'bolna': 'speak',
          'jaana': 'go', 'aana': 'come', 'karna': 'do', 'dena': 'give', 'lena': 'take',
          'samajhna': 'understand', 'pata': 'know', 'malum': 'known', 'zaroor': 'definitely',
          'bilkul': 'absolutely', 'shayad': 'maybe', 'mujhe': 'to me', 'tujhe': 'to you',
          'usko': 'to him/her', 'unko': 'to them', 'inke': 'of these', 'unke': 'of those',
          'yeh': 'this', 'woh': 'that'
        }
      }
    };
    
    // Handle English to other languages
    if (source === 'auto' || source === 'en') {
      const translations = basicTranslations.en[target];
      if (translations) {
        const lowerQ = q.toLowerCase().trim();
        
        // Try exact matches first
        if (translations[lowerQ]) {
          const translatedText = translations[lowerQ];
          return res.status(200).json({ translatedText });
        }
        
        // Try partial matches
        for (const [english, translated] of Object.entries(translations)) {
          if (lowerQ.includes(english)) {
            const translatedText = q.replace(new RegExp(english, 'gi'), translated);
            return res.status(200).json({ translatedText });
          }
        }
      }
    }
    
    // Handle Hindi to English (for transliterated text)
    if (source === 'hi' && target === 'en') {
      const translations = basicTranslations.hi?.en;
      if (translations) {
        const lowerQ = q.toLowerCase().trim();
        
        // Try exact matches first
        if (translations[lowerQ]) {
          const translatedText = translations[lowerQ];
          return res.status(200).json({ translatedText });
        }
        
        // Try partial matches for transliterated Hindi
        let translatedText = q;
        let hasTranslation = false;
        
        for (const [hindi, english] of Object.entries(translations)) {
          if (lowerQ.includes(hindi)) {
            translatedText = translatedText.replace(new RegExp(hindi, 'gi'), english);
            hasTranslation = true;
          }
        }
        
        if (hasTranslation) {
          return res.status(200).json({ translatedText });
        }
      }
    }
  } catch (error) {
    // Continue to fallback
  }

  // Final fallback: return original text with error message
  
  // Check if any service returned an error message that we should display
  let errorMessage = 'Translation failed';
  
  // Try to provide a more helpful error message
  if (source === 'auto' && target === 'en') {
    errorMessage = 'Auto-detection may have failed. Try selecting a specific source language.';
  } else if (source === target) {
    errorMessage = 'Source and target languages are the same. No translation needed.';
  } else {
    errorMessage = 'All translation services are currently unavailable. Please try again later.';
  }
  
  return res.status(200).json({ 
    translatedText: `[${errorMessage}] ${q}`,
    error: true,
    errorDetails: errorMessage
  });
}


