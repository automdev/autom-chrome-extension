chrome.action.onClicked.addListener((tab) => {
    chrome.windows.create({
      url: chrome.runtime.getURL("index.html"),
      type: "popup",
      width: 1200,
      height: 800,
      left: 100,
      top: 100
    });
  });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.apiKey && message.query) {
        const url = 'https://autom.dev/api/v1/google/search';
        const data = { query: message.query };

        // Effectuer la requête à l'API autom.dev
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': message.apiKey
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Renvoyer les résultats au script de contenu (index.js)
            sendResponse({ results: data.organic_results });
        })
        .catch(error => {
            console.error('Error:', error);
            sendResponse({ error: error.message });
        });

        // Indiquer que la réponse sera envoyée de manière asynchrone
        return true;
    }
});
