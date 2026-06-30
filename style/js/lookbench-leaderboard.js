// LookBench Leaderboard Script
let currentSubtask = 'Real Studio';
let benchmarkData = null;

// Load benchmark data on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Loading LookBench leaderboard...');
    loadBenchmarkData();
});

function loadBenchmarkData() {
    fetch('./configs/release_v2601/benchmark.json')
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
        'real-studio': 'Real Studio',
        'ih-long': 'ZooClaw-Fashion (long query)',
        'ih-short': 'ZooClaw-Fashion (short query)',
        'fashion200k': 'Fashion200k',
        'hm': 'H&M'
    };

    currentSubtask = subtaskMap[subtask];
    loadTable(currentSubtask);
}

// Derive the metric/k schema by inspecting the first model entry.
// Returns an ordered list of {metric, ks: [...]}.
function getSchema(subtaskData) {
    const models = Object.keys(subtaskData);
    if (models.length === 0) return [];
    const firstModel = subtaskData[models[0]];
    return Object.keys(firstModel).map(metric => ({
        metric,
        ks: Object.keys(firstModel[metric])
    }));
}

function buildHeader(schema) {
    const thead = document.querySelector('#lookbench-table thead');
    thead.innerHTML = '';

    // Row 1: metric-group cells
    const row1 = document.createElement('tr');
    const modelTh = document.createElement('th');
    modelTh.rowSpan = 2;
    modelTh.style.width = '180px';
    modelTh.style.borderRight = '1px solid #ccc';
    modelTh.textContent = 'Model';
    row1.appendChild(modelTh);

    schema.forEach((group, gIdx) => {
        const th = document.createElement('th');
        th.colSpan = group.ks.length;
        th.className = 'section-header' + (gIdx < schema.length - 1 ? ' metric-group' : '');
        th.textContent = group.metric;
        row1.appendChild(th);
    });
    thead.appendChild(row1);

    // Row 2: k-value cells. Default sort on the LAST metric group's first column
    // (nDCG@1 for LookBench tabs, MRR@10 for ZooClaw-Fashion tabs).
    const row2 = document.createElement('tr');
    schema.forEach((group, gIdx) => {
        group.ks.forEach((k, kIdx) => {
            const th = document.createElement('th');
            const isLastInGroup = kIdx === group.ks.length - 1;
            const notLastGroup = gIdx < schema.length - 1;
            const isDefaultSort = gIdx === schema.length - 1 && kIdx === 0;
            th.className = 'sortable'
                + (isLastInGroup && notLastGroup ? ' metric-group-last' : '')
                + (isDefaultSort ? ' sorted-desc' : '');
            th.dataset.sort = 'number';
            th.textContent = k;
            row2.appendChild(th);
        });
    });
    thead.appendChild(row2);
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
    const schema = getSchema(subtaskData);
    buildHeader(schema);

    // Calculate best and second best for each metric
    const bestScores = calculateBestScores(subtaskData, models, schema);

    // Default sort: by the last metric group's first column (nDCG@1 / MRR@10)
    const sortMetric = schema[schema.length - 1].metric;
    const sortK = schema[schema.length - 1].ks[0];
    models.sort((a, b) => {
        const aScore = (subtaskData[a][sortMetric] || {})[sortK] || 0;
        const bScore = (subtaskData[b][sortMetric] || {})[sortK] || 0;
        return bScore - aScore;
    });
    
    // Model links mapping
    const modelLinks = {
        'GR-Lite': 'https://huggingface.co/srpone/gr-lite',
        'GR-Pro': 'https://gensmo.com/enterprise-solution',
        'Tianmu-MERE': 'https://huggingface.co/TianmuLab/Tianmu-MERE',
        'ZooClaw-FashionSigLIP2': 'https://huggingface.co/srpone/zooclaw-fashionsiglip2',
        'Marqo-fashionSigLIP': 'https://github.com/marqo-ai/marqo',
        'Marqo-fashionCLIP': 'https://github.com/marqo-ai/marqo',
        'LLM2CLIP': 'https://github.com/microsoft/LLM2CLIP',
        'PP-ShiTuV2': 'https://github.com/PaddlePaddle/PaddleClas',
        'CLIP-B/32': 'https://github.com/openai/CLIP',
        'CLIP-L/14': 'https://github.com/openai/CLIP',
        'SigLIP2-B/16': 'https://github.com/google-research/big_vision',
        'SigLIP2-B/16 (zero-shot)': 'https://github.com/google-research/big_vision',
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
        
        // Add metric cells (schema-driven)
        schema.forEach((group, gIdx) => {
            group.ks.forEach((k, kIdx) => {
                const cell = document.createElement('td');
                const value = (modelData[group.metric] || {})[k];
                const formattedValue = (value !== undefined && value !== null) ? value.toFixed(2) : '-';

                // Border after the last column of each metric group (except the last group)
                if (kIdx === group.ks.length - 1 && gIdx < schema.length - 1) {
                    cell.style.borderRight = '1px solid #ccc';
                }

                // Apply styling for best/second best
                const metricKey = `${group.metric}_${k}`;
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

function calculateBestScores(subtaskData, models, schema) {
    const bestScores = {};
    schema.forEach(group => {
        group.ks.forEach(k => {
            const scores = models
                .map(model => (subtaskData[model][group.metric] || {})[k])
                .filter(s => s != null);
            scores.sort((a, b) => b - a);
            bestScores[`${group.metric}_${k}`] = {
                best: scores[0],
                secondBest: scores[1]
            };
        });
    });
    return bestScores;
}

