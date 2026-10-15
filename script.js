const colors = ["#b7d881", "#f2b06e", "#82c6ba", "#d5a5d9", "#e58c7a"];
const boxRows = document.querySelector("#rows");
let calculation = null;
let viewMode = "top";

function addBoxRow() {
    if (boxRows.children.length >= 5) return;

    const number = boxRows.children.length + 1;
    const row = document.createElement("div");
    row.className = "box-row";
    row.style.setProperty("--box-color", colors[number - 1]);
    row.innerHTML = `
        <div class="box-row-top">
            <strong class="box-name">Rozmiar ${number}</strong>
            ${number > 1 ? '<button class="remove" type="button" aria-label="Usuń rozmiar">Usuń</button>' : ""}
        </div>
        <div class="box-inputs">
            <label>Długość
                <div class="input-wrap"><input class="box-l" type="number" min="0.1" step="0.1" placeholder="np. 40"><span class="suffix">cm</span></div>
            </label>
            <label>Szerokość
                <div class="input-wrap"><input class="box-w" type="number" min="0.1" step="0.1" placeholder="np. 30"><span class="suffix">cm</span></div>
            </label>
            <label>Liczba sztuk
                <input class="box-q" type="number" min="1" step="1" placeholder="np. 12">
            </label>
        </div>
    `;

    const removeButton = row.querySelector(".remove");
    if (removeButton) {
        removeButton.addEventListener("click", function () {
            row.remove();
            updateRowNumbers();
        });
    }

    boxRows.append(row);
    updateRowNumbers();
}

function updateRowNumbers() {
    const rows = boxRows.children;

    for (let i = 0; i < rows.length; i++) {
        rows[i].style.setProperty("--box-color", colors[i]);
        rows[i].querySelector(".box-name").textContent = `Rozmiar ${i + 1}`;
    }

    document.querySelector("#typeCount").textContent = `${rows.length} / 5 rozmiarów`;
    document.querySelector("#addType").classList.toggle("hidden", rows.length >= 5);
}

document.querySelector("#addType").addEventListener("click", addBoxRow);
addBoxRow();

function packOneLayer(palletLength, palletWidth, boxes, canRotate, placeMode) {
    let freeSpaces = [{ x: 0, y: 0, width: palletLength, height: palletWidth }];
    const placedBoxes = [];

    for (const box of boxes) {
        let bestPlace = null;

        for (const space of freeSpaces) {
            const positions = [[box.width, box.depth]];
            if (canRotate && box.width !== box.depth) {
                positions.push([box.depth, box.width]);
            }

            for (const [width, depth] of positions) {
                if (width > space.width || depth > space.height) continue;

                const freeWidth = space.width - width;
                const freeHeight = space.height - depth;
                const shortSide = Math.min(freeWidth, freeHeight);
                const longSide = Math.max(freeWidth, freeHeight);
                const freeArea = space.width * space.height - width * depth;
                let score;

                if (placeMode === 0) {
                    score = shortSide * 100000 + longSide;
                } else if (placeMode === 1) {
                    score = freeArea;
                } else if (placeMode === 2) {
                    score = (space.y + depth) * 100000 + space.x;
                } else {
                    score = longSide * 100000 + shortSide;
                }

                if (!bestPlace || score < bestPlace.score) {
                    bestPlace = {
                        x: space.x,
                        y: space.y,
                        width: width,
                        depth: depth,
                        score: score,
                        box: box
                    };
                }
            }
        }

        if (!bestPlace) continue;
        placedBoxes.push(bestPlace);

        const newSpaces = [];
        for (const space of freeSpaces) {
            const doesNotOverlap =
                bestPlace.x >= space.x + space.width ||
                bestPlace.x + bestPlace.width <= space.x ||
                bestPlace.y >= space.y + space.height ||
                bestPlace.y + bestPlace.depth <= space.y;

            if (doesNotOverlap) {
                newSpaces.push(space);
                continue;
            }

            if (bestPlace.x > space.x) {
                newSpaces.push({
                    x: space.x,
                    y: space.y,
                    width: bestPlace.x - space.x,
                    height: space.height
                });
            }
            if (bestPlace.x + bestPlace.width < space.x + space.width) {
                newSpaces.push({
                    x: bestPlace.x + bestPlace.width,
                    y: space.y,
                    width: space.x + space.width - bestPlace.x - bestPlace.width,
                    height: space.height
                });
            }
            if (bestPlace.y > space.y) {
                newSpaces.push({
                    x: space.x,
                    y: space.y,
                    width: space.width,
                    height: bestPlace.y - space.y
                });
            }
            if (bestPlace.y + bestPlace.depth < space.y + space.height) {
                newSpaces.push({
                    x: space.x,
                    y: bestPlace.y + bestPlace.depth,
                    width: space.width,
                    height: space.y + space.height - bestPlace.y - bestPlace.depth
                });
            }
        }

        freeSpaces = newSpaces.filter(function (space, index) {
            return !newSpaces.some(function (other, otherIndex) {
                const isInsideOther =
                    space.x >= other.x &&
                    space.y >= other.y &&
                    space.x + space.width <= other.x + other.width &&
                    space.y + space.height <= other.y + other.height;
                return index !== otherIndex && isInsideOther;
            });
        });
    }

    return placedBoxes;
}

function chooseLayer(palletLength, palletWidth, boxes, canRotate) {
    const boxesInOrder = boxes.slice().sort(function (a, b) {
        const areaA = a.width * a.depth;
        const areaB = b.width * b.depth;
        if (areaA !== areaB) return areaB - areaA;
        return Math.max(b.width, b.depth) - Math.max(a.width, a.depth);
    });

    let bestPlan = [];
    let bestArea = 0;

    for (let mode = 0; mode < 4; mode++) {
        const plan = packOneLayer(
            palletLength,
            palletWidth,
            boxesInOrder,
            canRotate,
            mode
        );
        const area = plan.reduce(function (sum, item) {
            return sum + item.width * item.depth;
        }, 0);

        if (area > bestArea || (area === bestArea && plan.length > bestPlan.length)) {
            bestPlan = plan;
            bestArea = area;
        }
    }

    return bestPlan;
}

function makeLayers(palletLength, palletWidth, boxTypes, canRotate) {
    const remainingBoxes = [];
    let nextId = 1;

    for (const type of boxTypes) {
        for (let i = 0; i < type.count; i++) {
            remainingBoxes.push({ ...type, id: nextId });
            nextId++;
        }
    }

    const layers = [];
    while (remainingBoxes.length > 0) {
        const layer = chooseLayer(palletLength, palletWidth, remainingBoxes, canRotate);
        if (layer.length === 0) break;

        layers.push(layer);
        const usedIds = new Set(layer.map(function (item) {
            return item.box.id;
        }));

        for (let i = remainingBoxes.length - 1; i >= 0; i--) {
            if (usedIds.has(remainingBoxes[i].id)) {
                remainingBoxes.splice(i, 1);
            }
        }
    }

    return { layers: layers, boxesLeft: remainingBoxes.length };
}

function calculatePlan() {
    const message = document.querySelector("#message");
    message.textContent = "";

    const palletLength = Number(document.querySelector("#palletL").value);
    const palletWidth = Number(document.querySelector("#palletW").value);
    const palletHeight = Number(document.querySelector("#palletH").value);
    const boxHeight = Number(document.querySelector("#boxH").value);

    if (palletLength <= 0 || palletWidth <= 0 || palletHeight <= 0 || boxHeight <= 0) {
        message.textContent = "Uzupełnij wszystkie wymiary wartościami większymi od zera.";
        return;
    }

    const boxTypes = Array.from(boxRows.children).map(function (row, index) {
        return {
            width: Number(row.querySelector(".box-l").value),
            depth: Number(row.querySelector(".box-w").value),
            count: Number(row.querySelector(".box-q").value),
            color: colors[index],
            name: `Rozmiar ${index + 1}`
        };
    });

    const wrongValues = boxTypes.some(function (box) {
        return box.width <= 0 || box.depth <= 0 ||
            box.count <= 0 || !Number.isInteger(box.count);
    });
    if (boxTypes.length === 0 || wrongValues) {
        message.textContent = "Uzupełnij długość, szerokość i liczbę kartonów dla każdego rozmiaru.";
        return;
    }

    const canRotate = document.querySelector("#rotate").checked;
    const tooLarge = boxTypes.some(function (box) {
        const fitsAsEntered = box.width <= palletLength && box.depth <= palletWidth;
        const fitsTurned = box.depth <= palletLength && box.width <= palletWidth;
        return canRotate ? !fitsAsEntered && !fitsTurned : !fitsAsEntered;
    });
    if (tooLarge) {
        message.textContent = "Jeden z kartonów jest większy od palety.";
        return;
    }

    const result = makeLayers(palletLength, palletWidth, boxTypes, canRotate);
    if (result.layers.length === 0) {
        message.textContent = "Nie udało się ułożyć kartonów. Sprawdź podane wymiary.";
        return;
    }

    calculation = {
        palletLength: palletLength,
        palletWidth: palletWidth,
        palletHeight: palletHeight,
        boxHeight: boxHeight,
        layers: result.layers,
        boxTypes: boxTypes,
        boxesLeft: result.boxesLeft
    };

    const placedCount = result.layers.reduce(function (sum, layer) {
        return sum + layer.length;
    }, 0);
    const totalBoxCount = boxTypes.reduce(function (sum, box) {
        return sum + box.count;
    }, 0);
    const totalHeight = palletHeight + result.layers.length * boxHeight;
    const palletArea = palletLength * palletWidth;
    const usedArea = result.layers.reduce(function (total, layer) {
        const layerArea = layer.reduce(function (sum, box) {
            return sum + box.width * box.depth;
        }, 0);
        return total + layerArea;
    }, 0);
    const occupiedPercent = (usedArea / (palletArea * result.layers.length) * 100)
        .toFixed(1)
        .replace(".", ",");
    const lastLayer = result.layers[result.layers.length - 1];
    const lastLayerArea = lastLayer.reduce(function (sum, box) {
        return sum + box.width * box.depth;
    }, 0);
    const freeArea = palletArea - lastLayerArea;

    document.querySelector("#placed").textContent = placedCount.toLocaleString("pl-PL");
    document.querySelector("#coverage").textContent = `${occupiedPercent}%`;
    document.querySelector("#layerCount").textContent = result.layers.length;
    document.querySelector("#totalHeight").textContent = `${totalHeight} cm`;

    const notPlacedText = totalBoxCount > placedCount
        ? ` Nie zmieściło się ${totalBoxCount - placedCount} kartonów.`
        : " Wszystkie kartony zostały ułożone.";
    document.querySelector("#footnote").textContent =
        `Średnie zajęcie powierzchni warstw: ${occupiedPercent}%. ` +
        `Wolne miejsce na ostatniej warstwie: ${freeArea.toLocaleString("pl-PL")} cm².` +
        `${notPlacedText} Widok nie sprawdza stabilności ani wytrzymałości stosu.`;

    const layerSelect = document.querySelector("#layerSelect");
    layerSelect.innerHTML = "";
    for (let i = 0; i < result.layers.length; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `Warstwa ${i + 1}`;
        layerSelect.append(option);
    }

    document.querySelector("#layerChoice").classList.toggle("hidden", result.layers.length < 2);
    document.querySelector("#viewTop").classList.add("active");
    document.querySelector("#view3d").classList.remove("active");
    viewMode = "top";
    drawCurrentView();
    drawLegend(boxTypes);
}

function drawCurrentView() {
    if (!calculation) return;

    const description = document.querySelector("#viewDescription");
    if (viewMode === "top") {
        const layerNumber = Number(document.querySelector("#layerSelect").value || 0);
        description.textContent = `Widok z góry — warstwa ${layerNumber + 1} z ${calculation.layers.length}.`;
        showLayerCoverage(calculation, layerNumber);
        drawTopView(calculation, layerNumber);
    } else {
        description.textContent = "Widok 3D palety i wszystkich warstw.";
        showAverageCoverage(calculation);
        draw3dView(calculation);
    }
}
function showLayerCoverage(data, layerNumber) {
    const layer = data.layers[layerNumber];
    const area = layer.reduce(function (sum, box) {
        return sum + box.width * box.depth;
    }, 0);
    const palletArea = data.palletLength * data.palletWidth;
    const percent = (area / palletArea * 100).toFixed(1).replace(".", ",");

    document.querySelector("#coverage").textContent = `${percent}%`;
    document.querySelector("#coverageLabel").textContent =
        `zajęte miejsce — warstwa ${layerNumber + 1}`;
}

function showAverageCoverage(data) {
    const totalArea = data.layers.reduce(function (allLayersArea, layer) {
        const layerArea = layer.reduce(function (sum, box) {
            return sum + box.width * box.depth;
        }, 0);
        return allLayersArea + layerArea;
    }, 0);
    const palletArea = data.palletLength * data.palletWidth;
    const percent = (totalArea / (palletArea * data.layers.length) * 100)
        .toFixed(1)
        .replace(".", ",");

    document.querySelector("#coverage").textContent = `${percent}%`;
    document.querySelector("#coverageLabel").textContent = "średnio zajęte miejsce";
}
function drawTopView(data, layerNumber) {
    const canvas = document.querySelector("#canvas");
    const viewWidth = 500;
    const viewHeight = 360;
    const padding = 24;
    const scale = Math.min(
        (viewWidth - padding * 2) / data.palletLength,
        (viewHeight - padding * 2) / data.palletWidth
    );
    const drawWidth = data.palletLength * scale;
    const drawHeight = data.palletWidth * scale;
    const left = (viewWidth - drawWidth) / 2;
    const top = (viewHeight - drawHeight) / 2;
    const boxes = data.layers[layerNumber];

    let svg = `<svg viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Widok kartonów z góry">
        <rect x="${left}" y="${top}" width="${drawWidth}" height="${drawHeight}" fill="#e5c99d" stroke="#8c6b45" stroke-width="2" />`;

    for (const item of boxes) {
        const x = left + item.x * scale;
        const y = top + item.y * scale;
        const width = item.width * scale;
        const height = item.depth * scale;

        svg += `<rect x="${x + 1}" y="${y + 1}" width="${Math.max(0, width - 2)}" height="${Math.max(0, height - 2)}" fill="${item.box.color}" stroke="#333" />`;
        if (width > 30 && height > 20) {
            svg += `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="11">${item.box.name.replace("Rozmiar ", "R")}</text>`;
        }
    }

    svg += `<text x="${viewWidth / 2}" y="${top - 8}" text-anchor="middle" font-size="12">${data.palletLength} cm</text>
        <text x="${left - 8}" y="${viewHeight / 2}" text-anchor="middle" font-size="12" transform="rotate(-90 ${left - 8} ${viewHeight / 2})">${data.palletWidth} cm</text>
        </svg>`;
    canvas.innerHTML = svg;
    canvas.classList.remove("empty");
}

function draw3dView(data) {
    const canvas = document.querySelector("#canvas");
    const viewWidth = 560;
    const viewHeight = 420;
    const stackHeight = data.palletHeight + data.layers.length * data.boxHeight;
    const diagonalHeight = (data.palletLength + data.palletWidth) * 0.42;
    const scale = Math.min(
        (viewWidth - 100) / (data.palletLength + data.palletWidth),
        (viewHeight - 90) / (diagonalHeight + stackHeight)
    );
    const xOffset = data.palletWidth;
    const offsetX = (viewWidth - (data.palletLength + data.palletWidth) * scale) / 2 + xOffset * scale;
    const offsetY = 30 + stackHeight * scale;

    function point(x, y, z) {
        return {
            x: offsetX + (x - y) * scale,
            y: offsetY + ((x + y) * 0.42 - z) * scale
        };
    }

    function pointsText(points) {
        return points.map(function (p) {
            return `${p.x},${p.y}`;
        }).join(" ");
    }

    function polygon(points, fill, opacity = 1) {
        return `<polygon points="${pointsText(points)}" fill="${fill}" fill-opacity="${opacity}" stroke="#333" stroke-width="1" />`;
    }

    let svg = `<svg viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Trójwymiarowy widok palety z kartonami">`;

    const palletA = point(0, 0, data.palletHeight);
    const palletB = point(data.palletLength, 0, data.palletHeight);
    const palletC = point(data.palletLength, data.palletWidth, data.palletHeight);
    const palletD = point(0, data.palletWidth, data.palletHeight);
    const bottomA = point(0, 0, 0);
    const bottomB = point(data.palletLength, 0, 0);
    const bottomC = point(data.palletLength, data.palletWidth, 0);
    const bottomD = point(0, data.palletWidth, 0);

    svg += polygon([palletB, palletC, bottomC, bottomB], "#a98355");
    svg += polygon([palletD, palletC, bottomC, bottomD], "#927047");
    svg += polygon([palletA, palletB, palletC, palletD], "#d6b17e");

    for (let layerNumber = 0; layerNumber < data.layers.length; layerNumber++) {
        const baseZ = data.palletHeight + layerNumber * data.boxHeight;
        const layer = data.layers[layerNumber].slice().sort(function (a, b) {
            return a.x + a.y - (b.x + b.y);
        });

        for (const item of layer) {
            const x = item.x;
            const y = item.y;
            const right = x + item.width;
            const front = y + item.depth;
            const bottomA = point(x, y, baseZ);
            const bottomB = point(right, y, baseZ);
            const bottomC = point(right, front, baseZ);
            const bottomD = point(x, front, baseZ);
            const topA = point(x, y, baseZ + data.boxHeight);
            const topB = point(right, y, baseZ + data.boxHeight);
            const topC = point(right, front, baseZ + data.boxHeight);
            const topD = point(x, front, baseZ + data.boxHeight);

            svg += polygon([bottomB, bottomC, topC, topB], item.box.color, 0.82);
            svg += polygon([bottomD, bottomC, topC, topD], item.box.color, 0.65);
            svg += polygon([topA, topB, topC, topD], item.box.color);
        }
    }

    svg += `<text x="${viewWidth / 2}" y="${viewHeight - 12}" text-anchor="middle" font-size="12">${data.palletLength} × ${data.palletWidth} cm · ${data.layers.length} warstw · razem ${stackHeight} cm wysokości</text></svg>`;
    canvas.innerHTML = svg;
    canvas.classList.remove("empty");
}

function drawLegend(boxTypes) {
    document.querySelector("#legend").innerHTML = boxTypes.map(function (box) {
        return `<span class="legend-item"><i class="legend-swatch" style="background:${box.color}"></i>${box.name}: ${box.width} × ${box.depth} cm</span>`;
    }).join("");
}

function setView(mode) {
    viewMode = mode;
    document.querySelector("#viewTop").classList.toggle("active", mode === "top");
    document.querySelector("#view3d").classList.toggle("active", mode === "3d");
    document.querySelector("#layerChoice").classList.toggle(
        "hidden",
        mode !== "top" || !calculation || calculation.layers.length < 2
    );
    drawCurrentView();
}

document.querySelector("#calculate").addEventListener("click", calculatePlan);
document.querySelector("#viewTop").addEventListener("click", function () {
    setView("top");
});
document.querySelector("#view3d").addEventListener("click", function () {
    setView("3d");
});
document.querySelector("#layerSelect").addEventListener("change", drawCurrentView);






