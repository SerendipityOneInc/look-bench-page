// LookBench Leaderboard Script
let currentSubtask = 'Real Studio';
let benchmarkData = null;

// Load benchmark data on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Loading LookBench leaderboard...');
    loadBenchmarkData();
});

function loadBenchmarkData() {
    fetch('./configs/release_v2512/benchmark.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('Benchmark data loaded successfully');
            benchmarkData = data;
            loadTable('Real Studio');
        })
        .catch(error => {
            console.error('Error loading benchmark data:', error);
            document.querySelector('#lookbench-table tbody').innerHTML = 
                `<tr><td colspan="13">Error loading data: ${error.message}</td></tr>`;
        });
}

function switchSubtask(subtask) {
    // Update active tab
    document.querySelectorAll('.table-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Map subtask ID to data key
    const subtaskMap = {
        'ai-gen-streetlook': 'AI-Gen StreetLook',
        'real-streetlook': 'Real StreetLook',
        'ai-gen-studio': 'AI-Gen Studio',
        'real-studio': 'Real Studio'
    };
    
    currentSubtask = subtaskMap[subtask];
    loadTable(currentSubtask);
}

function loadTable(subtaskName) {
    if (!benchmarkData || !benchmarkData[subtaskName]) {
        console.error(`No data found for subtask: ${subtaskName}`);
        return;
    }
    
    const tbody = document.querySelector('#lookbench-table tbody');
    tbody.innerHTML = '';
    
    const subtaskData = benchmarkData[subtaskName];
    const models = Object.keys(subtaskData);
    
    // Calculate best and second best for each metric
    const bestScores = calculateBestScores(subtaskData, models);
    
    // Sort models by nDCG@1 (descending)
    models.sort((a, b) => {
        const aScore = subtaskData[a]['nDCG']['@1'] || 0;
        const bScore = subtaskData[b]['nDCG']['@1'] || 0;
        return bScore - aScore;
    });
    
    // Model links mapping
    const modelLinks = {
        'GR-Lite': 'https://huggingface.co/srpone/gr-lite',
        'GR-Pro': 'https://gensmo.com/',
        'Marqo-fashionSigLIP': 'https://github.com/marqo-ai/marqo',
        'Marqo-fashionCLIP': 'https://github.com/marqo-ai/marqo',
        'PP-ShiTuV2': 'https://github.com/PaddlePaddle/PaddleClas',
        'CLIP-B/32': 'https://github.com/openai/CLIP',
        'CLIP-L/14': 'https://github.com/openai/CLIP',
        'SigLIP2-B/16': 'https://github.com/google-research/big_vision',
        'SigLIP2-L/16': 'https://github.com/google-research/big_vision',
        'DINOv2-ViT-L': 'https://github.com/facebookresearch/dinov2',
        'DINOv2-ViT-G': 'https://github.com/facebookresearch/dinov2',
        'DINOv3-ViT-L': 'https://github.com/facebookresearch/dinov2',
        'DINOv3-ConvNeXt-L': 'https://github.com/facebookresearch/dinov2',
        'DINOv3-ViT-7B': 'https://github.com/facebookresearch/dinov2',
        'InternViT-6B': 'https://github.com/OpenGVLab/InternVL'
    };
    
    // Define proprietary models (all others are open-source)
    const proprietaryModels = ['GR-Pro'];
    
    // Create table rows
    models.forEach(modelName => {
        const modelData = subtaskData[modelName];
        const tr = document.createElement('tr');
        
        // Determine if model is proprietary or open source
        const isProprietary = proprietaryModels.includes(modelName);
        const modelClass = isProprietary ? 'proprietary' : 'open_source';
        
        // Apply class to entire row
        tr.classList.add(modelClass);
        
        // Model name cell with link
        const nameCell = document.createElement('td');
        nameCell.style.borderRight = '1px solid #ccc';
        const modelLink = modelLinks[modelName];
        if (modelLink) {
            nameCell.innerHTML = `<a href="${modelLink}" target="_blank" style="text-decoration: none; color: inherit; font-weight: 500;">${modelName}</a>`;
        } else {
            nameCell.innerHTML = `<span style="font-weight: 500;">${modelName}</span>`;
        }
        tr.appendChild(nameCell);
        
        // Add metric cells
        ['Coarse Recall', 'Fine Recall', 'nDCG'].forEach((metric, metricIndex) => {
            ['@1', '@5', '@10', '@20'].forEach((k, kIndex) => {
                const cell = document.createElement('td');
                const value = modelData[metric][k];
                const formattedValue = value ? value.toFixed(2) : '-';
                
                // Add border after last column of each metric group (except last group)
                if (kIndex === 3 && metricIndex < 2) {
                    cell.style.borderRight = '1px solid #ccc';
                }
                
                // Apply styling for best/second best
                const metricKey = `${metric}_${k}`;
                if (bestScores[metricKey]) {
                    if (value === bestScores[metricKey].best) {
                        cell.innerHTML = `<b>${formattedValue}</b>`;
                    } else if (value === bestScores[metricKey].secondBest) {
                        cell.innerHTML = `<u>${formattedValue}</u>`;
                    } else {
                        cell.textContent = formattedValue;
                    }
                } else {
                    cell.textContent = formattedValue;
                }
                
                tr.appendChild(cell);
            });
        });
        
        tbody.appendChild(tr);
    });
    
    // Setup sorting after table is populated
    setupSorting();
}

function setupSorting() {
    const headers = document.querySelectorAll('#lookbench-table th.sortable');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => sortTableByColumn(index + 1)); // +1 because first column is model name
    });
}

function sortTableByColumn(columnIndex) {
    const table = document.querySelector('#lookbench-table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Determine current sort direction
    const header = table.querySelector(`th:nth-child(${columnIndex + 1})`);
    const isAscending = header.classList.contains('sorted-asc');
    
    // Remove all sort classes
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    // Add new sort class
    if (isAscending) {
        header.classList.add('sorted-desc');
    } else {
        header.classList.add('sorted-asc');
    }
    
    // Sort rows
    rows.sort((a, b) => {
        const aValue = parseFloat(a.cells[columnIndex].textContent) || 0;
        const bValue = parseFloat(b.cells[columnIndex].textContent) || 0;
        return isAscending ? (bValue - aValue) : (aValue - bValue);
    });
    
    // Reappend rows in sorted order
    rows.forEach(row => tbody.appendChild(row));
}

function calculateBestScores(subtaskData, models) {
    const bestScores = {};
    const metrics = ['Coarse Recall', 'Fine Recall', 'nDCG'];
    const ks = ['@1', '@5', '@10', '@20'];
    
    metrics.forEach(metric => {
        ks.forEach(k => {
            const scores = models.map(model => subtaskData[model][metric][k]).filter(s => s != null);
            scores.sort((a, b) => b - a);
            
            const metricKey = `${metric}_${k}`;
            bestScores[metricKey] = {
                best: scores[0],
                secondBest: scores[1]
            };
        });
    });
    
    return bestScores;
}

