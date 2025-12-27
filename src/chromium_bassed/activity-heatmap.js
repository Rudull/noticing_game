window.ActivityHeatmap = (function () {
    /**
     * Create a heatmap visualization
     * @param {Object} dailyStats - Object with format { "YYYY-MM-DD": count }
     * @param {Object} options - Configuration options
     */
    function create(dailyStats, options = {}) {
        const container = document.createElement("div");
        container.className = "noticing-heatmap-container";

        // Detect current year or use provided one
        let currentYear = options.year || new Date().getFullYear();
        const today = new Date();

        // State wrapper
        const state = {
            year: currentYear,
            dailyStats: dailyStats
        };

        function render() {
            container.innerHTML = "";

            // 1. Navigation Header
            const navContainer = document.createElement("div");
            navContainer.className = "noticing-heatmap-nav";

            const prevBtn = document.createElement("button");
            prevBtn.className = "noticing-heatmap-nav-btn";
            prevBtn.innerHTML = "&lt;"; // <
            prevBtn.title = "Previous Year";
            prevBtn.onclick = () => {
                state.year--;
                render();
            };

            const resetBtn = document.createElement("button");
            resetBtn.className = "noticing-heatmap-nav-btn";
            resetBtn.innerHTML = "o"; // Circle/Reset
            resetBtn.title = "Current Year";
            resetBtn.onclick = () => {
                state.year = new Date().getFullYear();
                render();
            };

            const nextBtn = document.createElement("button");
            nextBtn.className = "noticing-heatmap-nav-btn";
            nextBtn.innerHTML = "&gt;"; // >
            nextBtn.title = "Next Year";
            nextBtn.onclick = () => {
                state.year++;
                render();
            };

            // Disable next button if future
            if (state.year >= new Date().getFullYear()) {
                // nextBtn.disabled = true; // Optional: disable future navigation
                // For now, let's allow it but it will show empty
            }

            navContainer.appendChild(prevBtn);
            navContainer.appendChild(resetBtn);
            navContainer.appendChild(nextBtn);
            container.appendChild(navContainer);

            // 2. Heatmap Grid
            const scrollContainer = document.createElement("div");
            scrollContainer.className = "noticing-heatmap-scroll";

            const grid = document.createElement("div");
            grid.style.display = "grid";
            // 7 rows (days of week), ~53 columns
            grid.style.gridTemplateRows = "repeat(7, 9px)";
            grid.style.gridAutoFlow = "column";
            grid.style.columnGap = "1px"; // Decreased horizontal spacing
            grid.style.rowGap = "3px";    // Increased vertical spacing

            const startDate = new Date(state.year, 0, 1); // Jan 1
            const endDate = new Date(state.year, 11, 31); // Dec 31

            // Calculate offset for Monday start (Mon=0, ..., Sun=6)
            const jsDay = startDate.getDay(); // 0=Sun, 1=Mon...
            const offset = (jsDay + 6) % 7;

            // Create empty cells for offset
            for (let i = 0; i < offset; i++) {
                const empty = document.createElement("div");
                empty.style.width = "9px";
                empty.style.height = "9px";
                grid.appendChild(empty);
            }

            const yearStats = calculateYearStats(state.year, state.dailyStats);

            let loopDate = new Date(startDate);
            // Ensure we start at 00:00 local time
            loopDate.setHours(0, 0, 0, 0);

            while (loopDate <= endDate) {
                // Construct local date string YYYY-MM-DD
                const y = loopDate.getFullYear();
                const m = String(loopDate.getMonth() + 1).padStart(2, '0');
                const d = String(loopDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                const count = state.dailyStats[dateStr] || 0;

                const dayEl = document.createElement("div");
                dayEl.className = "noticing-heatmap-day";
                dayEl.dataset.date = dateStr;
                dayEl.dataset.count = count;

                // Level
                let level = 0;
                if (count > 0) level = 1;
                if (count >= 5) level = 2;
                if (count >= 10) level = 3;
                if (count >= 20) level = 4;

                dayEl.dataset.level = level;
                dayEl.title = `${count} words on ${dateStr}`;

                grid.appendChild(dayEl);

                loopDate.setDate(loopDate.getDate() + 1);
            }

            scrollContainer.appendChild(grid);
            container.appendChild(scrollContainer);

            // 3. Year Label
            const yearLabel = document.createElement("div");
            yearLabel.className = "noticing-heatmap-year-label";
            yearLabel.textContent = state.year;
            container.appendChild(yearLabel);

            // 4. Statistics Row
            const statsContainer = document.createElement("div");
            statsContainer.className = "noticing-heatmap-stats";

            // Daily Average
            // If current year, divide by days passed so far. If past year, divide by 365/366.
            statsContainer.appendChild(createStatItem("Daily average", `${yearStats.dailyAverage.toFixed(1)} words`, "stat-value-green"));
            statsContainer.appendChild(createStatItem("Days learned", `${yearStats.daysLearned}%`, "stat-value-green"));
            statsContainer.appendChild(createStatItem("Longest streak", `${yearStats.longestStreak} days`, "stat-value-green"));
            statsContainer.appendChild(createStatItem("Current streak", `${yearStats.currentStreak} days`, "stat-value-green"));
            statsContainer.appendChild(createStatItem("Habit health", `${yearStats.habitHealth}%`, "stat-value-green"));

            container.appendChild(statsContainer);
        }

        render();

        return container;
    }

    function createStatItem(label, value, valueClass = "") {
        const div = document.createElement("div");
        div.className = "noticing-heatmap-stat-item";

        const labelSpan = document.createElement("span");
        labelSpan.className = "noticing-heatmap-stat-label";
        labelSpan.textContent = label;

        const valueSpan = document.createElement("span");
        valueSpan.className = "noticing-heatmap-stat-value " + valueClass;
        valueSpan.textContent = value;

        div.appendChild(labelSpan);
        div.appendChild(valueSpan);
        return div;
    }

    function calculateYearStats(year, dailyStats) {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        const isCurrentYear = new Date().getFullYear() === year;
        const today = new Date();
        // Reset time for comparison
        today.setHours(0, 0, 0, 0);

        const effectiveEnd = (isCurrentYear && today < end) ? today : end;

        let totalWords = 0;
        let daysWithActivity = 0;
        let totalDays = 0;
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        let loopDate = new Date(start);
        // Iterate day by day
        while (loopDate <= effectiveEnd) {
            const y = loopDate.getFullYear();
            const m = String(loopDate.getMonth() + 1).padStart(2, '0');
            const d = String(loopDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            const count = dailyStats[dateStr] || 0;

            totalDays++;
            totalWords += count;

            if (count > 0) {
                daysWithActivity++;
                tempStreak++;
            } else {
                // Streak broken
                if (tempStreak > longestStreak) longestStreak = tempStreak;
                tempStreak = 0;
            }

            loopDate.setDate(loopDate.getDate() + 1);
        }
        // Check last streak
        if (tempStreak > longestStreak) longestStreak = tempStreak;

        // Calculate active current streak (working backwards from today)
        // Only meaningful if it's the current year or the year just ended?
        // User likely wants GLOBAL current streak, or streak within that year?
        // Usually "Current streak" implies *now*. But if viewing 2020, "Current streak" might mean "active streak at end of 2020"?
        // Standard behavior: Current Streak is usually GLOBAL current streak.
        // But the request says "displayed underneath the map".
        // Let's implement it as: streak ending on effectiveEnd.

        let streakEnd = 0;
        let d = new Date(effectiveEnd);
        // Check if today has activity? If no activity today, check yesterday?
        // Common logic: if today is 0, but yesterday was >0, streak is still alive (just not updated today).
        // If yesterday was 0, streak is 0.

        // First, check effectiveEnd date
        let checkDate = new Date(effectiveEnd);
        // Construct dateStr manual
        let y = checkDate.getFullYear();
        let m = String(checkDate.getMonth() + 1).padStart(2, '0');
        let dStr = String(checkDate.getDate()).padStart(2, '0');
        let dateStr = `${y}-${m}-${dStr}`;

        if ((dailyStats[dateStr] || 0) === 0) {
            // Check yesterday
            checkDate.setDate(checkDate.getDate() - 1);
            y = checkDate.getFullYear();
            m = String(checkDate.getMonth() + 1).padStart(2, '0');
            dStr = String(checkDate.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${dStr}`;

            if ((dailyStats[dateStr] || 0) === 0) {
                streakEnd = 0;
            } else {
                // Streak is alive from yesterday
                streakEnd = calculateStreakBackwards(checkDate, dailyStats);
            }
        } else {
            // Streak alive today
            streakEnd = calculateStreakBackwards(checkDate, dailyStats);
        }

        // Calculate Habit Health (Weighted over last 30 days)
        // Recent days have higher weight.
        // Day 0 (today/effectiveEnd): Weight 30
        // ...
        // Day 29: Weight 1
        // Max Score = 30 + 29 + ... + 1 = (30 * 31) / 2 = 465

        let healthScore = 0;
        let maxScore = 465;
        let healthCheckDate = new Date(effectiveEnd);

        for (let i = 0; i < 30; i++) {
            const y = healthCheckDate.getFullYear();
            const m = String(healthCheckDate.getMonth() + 1).padStart(2, '0');
            const dStr = String(healthCheckDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dStr}`;

            // If active, add weight
            if ((dailyStats[dateStr] || 0) > 0) {
                const weight = 30 - i;
                healthScore += weight;
            }
            healthCheckDate.setDate(healthCheckDate.getDate() - 1);
        }

        const habitHealth = Math.round((healthScore / maxScore) * 100);

        return {
            dailyAverage: totalDays > 0 ? (totalWords / totalDays) : 0,
            daysLearned: totalDays > 0 ? Math.round((daysWithActivity / totalDays) * 100) : 0,
            longestStreak: longestStreak,
            currentStreak: streakEnd,
            habitHealth: habitHealth
        };
    }

    function calculateStreakBackwards(startDate, dailyStats) {
        let streak = 0;
        let d = new Date(startDate);
        // Limit to lookback reasonable or infinite?
        // Stats passed in are full history.
        while (true) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dStr = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dStr}`;

            if ((dailyStats[dateStr] || 0) > 0) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }


    return { create };
})();
