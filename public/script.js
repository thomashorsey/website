document.addEventListener('DOMContentLoaded', async () => {
    const currentYear = document.querySelector('#current-year');
    if (currentYear) currentYear.textContent = new Date().getFullYear();

    const currentPath = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('nav ul li a').forEach(link => {
        if (link.href.includes(window.location.href)) link.classList.add('active');
    });

    const textElement = document.getElementById('target-text');
    const canvas = document.getElementById('overlayCanvas');
    const ctx = canvas.getContext('2d');
    
    let res = 12; 
    let grid = [];
    let cols, rows;
    let animationId = null;

    await document.fonts.ready;

    function capturePixels() {
        if (animationId) cancelAnimationFrame(animationId);

        // Get bounds of the greeting card container for the grid size
        const cardContainer = document.querySelector('.card-container') || textElement.parentElement;
        const parentRect = cardContainer.getBoundingClientRect();
        
        // Get bounds of the text element for sampling
        const rect = textElement.getBoundingClientRect();
        const style = window.getComputedStyle(textElement);
        
        // Canvas covers the whole card
        canvas.width = parentRect.width;
        canvas.height = parentRect.height;

        const fontSize = parseFloat(style.fontSize);
        res = fontSize / 8; 

        cols = Math.ceil(canvas.width / res);
        rows = Math.ceil(canvas.height / res);

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        tempCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        tempCtx.textAlign = style.textAlign; 
        tempCtx.textBaseline = "top"; 
        tempCtx.fillStyle = "black";

        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingRight = parseFloat(style.paddingRight);
        const maxWidth = rect.width - (paddingLeft + paddingRight);

        const words = textElement.innerText.split(/\s+/);
        let lines = [];
        let currentLine = words[0];
        for (let n = 1; n < words.length; n++) {
            let testLine = currentLine + ' ' + words[n];
            if (tempCtx.measureText(testLine).width > maxWidth) {
                lines.push(currentLine);
                currentLine = words[n];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);

        const rawLineHeight = parseFloat(style.lineHeight) || fontSize * 1.1;
        const snappedLineHeight = Math.round(rawLineHeight / res) * res;
        
        // Position relative to the card container
        let rawStartX = (style.textAlign === 'center') ? (rect.left - parentRect.left + rect.width / 2) : (rect.left - parentRect.left + paddingLeft);
        let rawStartY = (rect.top - parentRect.top); 

        lines.forEach((line, i) => {
            tempCtx.fillText(line, rawStartX, rawStartY + (i * snappedLineHeight));
        });

        const initialData = tempCtx.getImageData(0, 0, canvas.width, canvas.height).data;
        let firstX = -1, firstY = -1;

        for (let i = 0; i < initialData.length; i += 4) {
            if (initialData[i + 3] > 128) {
                const pIdx = i / 4;
                const x = pIdx % canvas.width;
                const y = Math.floor(pIdx / canvas.width);
                if (firstX === -1 || x < firstX) firstX = x;
                if (firstY === -1 || y < firstY) firstY = y;
            }
        }

        const offsetX = (Math.round(firstX / res) * res) - firstX;
        const offsetY = ((Math.round(firstY / res) * res) - firstY) + (3 * res);

        tempCtx.clearRect(0, 0, canvas.width, canvas.height);
        lines.forEach((line, i) => {
            const targetY = rawStartY + offsetY + (i * snappedLineHeight);
            const snappedY = Math.round(targetY / res) * res;
            tempCtx.fillText(line, rawStartX + offsetX, snappedY);
        });

        const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hits = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
        grid = new Array(cols).fill(0).map(() => new Array(rows).fill(0));

        for (let i = 0; i < imgData.length; i += 4) {
            if (imgData[i + 3] > 140) {
                const pixelIndex = i / 4;
                const sx = pixelIndex % canvas.width;
                const sy = Math.floor(pixelIndex / canvas.width);
                const gx = Math.floor(sx / res);
                const gy = Math.floor(sy / res);
                if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
                    hits[gx][gy]++;
                }
            }
        }

        const pixelsPerCell = res * res;
        const threshold = pixelsPerCell * 0.35; 

        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (hits[x][y] > threshold) {
                    grid[x][y] = 1;
                }
            }
        }
        
        textElement.style.visibility = 'visible';
        textElement.style.opacity = '0.3'; 

        draw();
        
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function countNeighbors(x, y) {
        let sum = 0;
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                if (i === 0 && j === 0) continue;
                const col = (x + i + cols) % cols;
                const row = (y + j + rows) % rows;
                sum += grid[col][row];
            }
        }
        return sum;
    }

    function update() {
        let next = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                let state = grid[x][y];
                let neighbors = countNeighbors(x, y);

                if (state === 0 && neighbors === 3) {
                    next[x][y] = 1;
                } else if (state === 1 && (neighbors < 2 || neighbors > 3)) {
                    next[x][y] = 0;
                } else {
                    next[x][y] = state;
                }
            }
        }
        grid = next;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black"; 
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (grid[x][y] === 1) {
                    ctx.fillRect(Math.floor(x * res), Math.floor(y * res), Math.ceil(res), Math.ceil(res));
                }
            }
        }
    }

    let lastTime = 0;
    const fps = 6; 

    function gameLoop(timestamp) {
        if (timestamp - lastTime > 1000 / fps) {
            if (textElement.style.visibility !== 'hidden') {
                textElement.style.visibility = 'hidden';
            }
            
            update();
            draw();
            lastTime = timestamp;
        }
        animationId = requestAnimationFrame(gameLoop);
    }

    capturePixels();

    window.addEventListener('resize', () => {
        capturePixels();
    });
});