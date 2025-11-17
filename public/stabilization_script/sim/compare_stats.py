#!/usr/bin/env python3
"""
Compare stats across different drip variants:
- 2 items/day (baseline)
- 1 item/day
- Hybrid streak-based drip
"""

import json
import os
from typing import Dict, Optional

# File paths
SINGLE_2_ITEMS = "sim/out/single_sim_stats_v_final.json"
SINGLE_1_ITEM = "sim/out/single_sim_stats_v_final_1item.json"
SINGLE_STREAK_DRIP = "sim/out/single_sim_stats_v_streak_drip.json"

MULTI_2_ITEMS = "sim/out/multi_sim_stats_v_final.json"
MULTI_1_ITEM = "sim/out/multi_sim_stats_v_final_1item.json"
MULTI_STREAK_DRIP = "sim/out/multi_sim_stats_v_streak_drip.json"

OUTPUT_FILE = "sim/out/comparison_stats.json"


def load_stats(filepath: str) -> Optional[Dict]:
    """Load JSON stats file if it exists."""
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return None


def format_rate(rate: float) -> str:
    """Format stabilization rate as percentage."""
    if isinstance(rate, float):
        return f"{rate*100:.2f}%" if rate <= 1.0 else f"{rate:.2f}%"
    return str(rate)


def main():
    # Load all stats files
    single_2 = load_stats(SINGLE_2_ITEMS)
    single_1 = load_stats(SINGLE_1_ITEM)
    single_streak = load_stats(SINGLE_STREAK_DRIP)
    
    multi_2 = load_stats(MULTI_2_ITEMS)
    multi_1 = load_stats(MULTI_1_ITEM)
    multi_streak = load_stats(MULTI_STREAK_DRIP)
    
    # Build comparison data structure
    comparison = {
        "single": {},
        "multi": {}
    }
    
    if single_2:
        comparison["single"]["2_items"] = single_2
    if single_1:
        comparison["single"]["1_item"] = single_1
    if single_streak:
        comparison["single"]["streak_drip"] = single_streak
    
    if multi_2:
        comparison["multi"]["2_items"] = multi_2
    if multi_1:
        comparison["multi"]["1_item"] = multi_1
    if multi_streak:
        comparison["multi"]["streak_drip"] = multi_streak
    
    # Save combined JSON
    os.makedirs("sim/out", exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(comparison, f, indent=2)
    print(f"✓ Combined stats saved to {OUTPUT_FILE}\n")
    
    # Print comparison table for single sim
    print("=" * 70)
    print("SINGLE SIM COMPARISON")
    print("=" * 70)
    print(f"{'Variant':<20} {'Rate':<12} {'Avg Days':<12} {'Avg Items':<12}")
    print("-" * 70)
    
    if single_2:
        rate = format_rate(single_2.get("stabilization_rate", 0))
        days = single_2.get("avg_days", 0)
        items = single_2.get("avg_items_used", 0)
        print(f"{'2_items/day':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    if single_1:
        rate = format_rate(single_1.get("stabilization_rate", 0))
        days = single_1.get("avg_days", 0)
        items = single_1.get("avg_items_used", 0)
        print(f"{'1_item/day':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    if single_streak:
        rate = format_rate(single_streak.get("stabilization_rate", 0))
        days = single_streak.get("avg_days", 0)
        items = single_streak.get("avg_items_used", 0)
        print(f"{'streak_drip':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    print()
    
    # Print comparison table for multi sim
    print("=" * 70)
    print("MULTI SIM COMPARISON")
    print("=" * 70)
    print(f"{'Variant':<20} {'Rate':<12} {'Avg Days':<12} {'Avg Items':<12}")
    print("-" * 70)
    
    if multi_2:
        rate = format_rate(multi_2.get("stabilization_rate", 0))
        days = multi_2.get("days_to_stabilization", {}).get("mean", 0)
        items = multi_2.get("items", {}).get("avg_per_stabilized", 0)
        print(f"{'2_items/day':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    if multi_1:
        rate = format_rate(multi_1.get("stabilization_rate", 0))
        days = multi_1.get("days_to_stabilization", {}).get("mean", 0)
        items = multi_1.get("items", {}).get("avg_per_stabilized", 0)
        print(f"{'1_item/day':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    if multi_streak:
        rate = format_rate(multi_streak.get("stabilization_rate", 0))
        days = multi_streak.get("days_to_stabilization", {}).get("mean", 0)
        items = multi_streak.get("items", {}).get("avg_per_stabilized", 0)
        print(f"{'streak_drip':<20} {rate:<12} {days:<12.2f} {items:<12.2f}")
    
    print()
    print("=" * 70)


if __name__ == "__main__":
    main()

