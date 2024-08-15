document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleApiKeyButton = document.getElementById('toggleApiKey');
    const searchButton = document.getElementById('searchButton');
    const clearResultsButton = document.getElementById('clearResultsButton');
    const downloadButton = document.getElementById('downloadButton');
    const resultsContainer = document.getElementById('resultsContainer');
    const loading = document.getElementById('loading');
    const apiUsage = document.getElementById('apiUsage');

    // Toggle API Key visibility
    toggleApiKeyButton.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleApiKeyButton.textContent = 'Hide API Key';
        } else {
            apiKeyInput.type = 'password';
            toggleApiKeyButton.textContent = 'Show API Key';
        }
    });

    // Load API Key from local storage if available
    chrome.storage.local.get(['apiKey'], async (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
            toggleApiKeyButton.textContent = apiKeyInput.type === 'password' ? 'Show API Key' : 'Hide API Key';

            // Fetch API usage info after loading API key
            await fetchApiUsage(result.apiKey);
        }
    });

    // Save API Key to local storage
    apiKeyInput.addEventListener('change', async () => {
        chrome.storage.local.set({ apiKey: apiKeyInput.value });

        // Fetch API usage info after saving new API key
        await fetchApiUsage(apiKeyInput.value);
    });

    // Function to fetch API usage
    async function fetchApiUsage(apiKey) {
        try {
            const response = await fetch('https://autom.dev/api/usage', {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.plan && data.remaining) {
                    apiUsage.textContent = `Plan: ${data.plan} | Remaining: ${data.remaining}`;
                } else {
                    apiUsage.textContent = 'Unable to retrieve API usage information.';
                }
            } else {
                apiUsage.textContent = 'Unable to retrieve API usage information.';
            }
        } catch (error) {
            console.error('Error fetching API usage:', error);
            apiUsage.textContent = 'Error fetching API usage information.';
        }
    }

    // Function to handle the search requests in batches
    async function processBatches(companyNames, apiKey, keepFirstResult, searchMode, batchSize = 5) {
        let index = 0;
        const total = companyNames.length;

        while (index < total) {
            const batch = companyNames.slice(index, index + batchSize);
            await Promise.all(batch.map(companyName => fetchResults(companyName, apiKey, keepFirstResult, searchMode)));
            index += batchSize;
        }
    }

    // Determine the query format based on the selected mode
    function getQueryForSearchMode(companyName, searchMode) {
        switch (searchMode) {
            case "linkedinCompanyURL":
                return `site:linkedin.com/company/ ${companyName}`;
            case "linkedinProfileURL":
                return `site:linkedin.com/in/ ${companyName}`;
            default:
                return companyName; // Default mode: Company Name to Company URL
        }
    }

    // Fetch results from the API
    async function fetchResults(companyName, apiKey, keepFirstResult, searchMode) {
        const query = getQueryForSearchMode(companyName, searchMode);
        const response = await fetch('https://autom.dev/api/v1/google/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({ query })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.organic_results) {
                let results = keepFirstResult ? [data.organic_results[0]] : data.organic_results;

                // Create table rows for results
                results.forEach(result => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="p-4 border-b">${result.title}</td>
                        <td class="p-4 border-b"><a href="${result.link}" class="text-blue-500" target="_blank">${result.link}</a></td>
                        <td class="p-4 border-b">${new URL(result.link).hostname}</td>
                        <td class="p-4 border-b">${result.snippet}</td>
                    `;
                    resultsContainer.querySelector('tbody').appendChild(row);
                });

                // Show the download button once results are available
                downloadButton.style.display = 'block';
            }
        } else {
            console.error('Error fetching data:', response.statusText);
        }
    }

    // Handle search button click
    searchButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter your API Key.');
            return;
        }

        const companyNames = document.getElementById('companyNames').value.trim().split('\n').filter(name => name.trim());
        const keepFirstResult = document.getElementById('keepFirstResult').checked;
        const searchMode = document.getElementById('searchMode').value;

        if (companyNames.length === 0) {
            alert('Please enter at least one company name.');
            return;
        }

        // Clear previous results
        resultsContainer.innerHTML = `
            <table class="w-full border-collapse">
                <thead>
                    <tr>
                        <th class="p-4 border-b">Title</th>
                        <th class="p-4 border-b">Link</th>
                        <th class="p-4 border-b">Domain</th>
                        <th class="p-4 border-b">Snippet</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        // Show loading indicator
        loading.style.display = 'flex';

        try {
            await processBatches(companyNames, apiKey, keepFirstResult, searchMode);
        } finally {
            // Hide loading indicator
            loading.style.display = 'none';
        }
    });

    // Clear results
    clearResultsButton.addEventListener('click', () => {
        resultsContainer.innerHTML = `
            <table class="w-full border-collapse">
                <thead>
                    <tr>
                        <th class="p-4 border-b">Title</th>
                        <th class="p-4 border-b">Link</th>
                        <th class="p-4 border-b">Domain</th>
                        <th class="p-4 border-b">Snippet</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        downloadButton.style.display = 'none';
    });

    // Download results as CSV
    downloadButton.addEventListener('click', () => {
        const rows = Array.from(resultsContainer.querySelectorAll('tbody tr'));
        const csvContent = 'data:text/csv;charset=utf-8,' 
            + rows.map(row => Array.from(row.querySelectorAll('td'))
                .map(td => td.innerText.replace(/,/g, ''))  // Remove commas
                .join(',')
            ).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'results.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

document.getElementById("searchMode").addEventListener("change", function() {
    const searchMode = this.value;
    const companyNamesTextarea = document.getElementById("companyNames");

    switch (searchMode) {
        case "linkedinProfileURL":
            companyNamesTextarea.placeholder = "Enter names, one per line (e.g., 'John Doe', 'Jane Smith')";
            break;
        default:
            companyNamesTextarea.placeholder = "Enter company names, one per line (e.g., 'Google', 'Facebook')";
    }
});
