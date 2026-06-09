"""
Learning Activities Database
Loads the 640-activity CSV and provides lookup by activity_id or bot_id.
Ported from dailytodo/backend with minor enhancements for mission-group queries.
"""
import os
import csv
import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("learning_db")


class LearningDB:
    def __init__(self, csv_path: Optional[str] = None):
        if not csv_path:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(current_dir, "..", "..", "mock_data",
                                    "Robot - Nhập liệu - learning_activities.csv")
        self.csv_path = os.path.abspath(csv_path)
        self.activities: Dict[str, Dict[str, Any]] = {}          # id → activity
        self._bot_id_index: Dict[str, str] = {}                   # bot_id → activity_id
        self._mission_index: Dict[str, List[str]] = {}            # mission_id → [activity_ids ordered]
        self.load_db()

    # ------------------------------------------------------------------
    def load_db(self):
        if not os.path.exists(self.csv_path):
            logger.error(f"CSV file not found at {self.csv_path}")
            return

        logger.info(f"Loading learning activities from {self.csv_path}...")
        try:
            with open(self.csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                if reader.fieldnames:
                    reader.fieldnames = [n.lstrip('\ufeff') for n in reader.fieldnames]

                for row in reader:
                    activity_id = (row.get("ID") or "").strip()
                    if not activity_id:
                        continue

                    learn_data_raw = row.get("learn_data", "")
                    learn_data: Dict[str, Any] = {}
                    if learn_data_raw.strip():
                        try:
                            learn_data = json.loads(learn_data_raw)
                        except json.JSONDecodeError:
                            try:
                                learn_data = json.loads(learn_data_raw.replace('""', '"'))
                            except Exception:
                                learn_data = {"raw_text": learn_data_raw}

                    order_raw = row.get("ORDER", "0") or "0"
                    try:
                        order_val = float(order_raw)
                    except ValueError:
                        order_val = 0.0

                    activity = {
                        "id": activity_id,
                        "name": row.get("NAME", ""),
                        "bot_id": row.get("BOT_ID", ""),
                        "mission_id": row.get("MISSION_ID", ""),
                        "order": order_val,
                        "creative_name": row.get("CREATIVE_NAME", ""),
                        "learn_data": learn_data,
                        "story": row.get("Story", ""),
                        "learn_mechanism": row.get("LEARN_MECHANISM (LLM type)", ""),
                        "activity_category": row.get("Activity_Category", ""),
                        "status": row.get("STATUS", ""),
                        "icon": row.get("ICON", ""),
                        "estimate_time": row.get("estimate time", ""),
                    }
                    self.activities[activity_id] = activity

                    bot_id_val = activity["bot_id"].strip()
                    if bot_id_val and bot_id_val not in self._bot_id_index:
                        self._bot_id_index[bot_id_val] = activity_id

                    mission_id = activity["mission_id"].strip()
                    if mission_id:
                        self._mission_index.setdefault(mission_id, []).append(activity_id)

            # Sort each mission group by ORDER
            for mission_id, ids in self._mission_index.items():
                self._mission_index[mission_id] = sorted(
                    ids, key=lambda aid: self.activities[aid]["order"]
                )

            logger.info(
                f"Loaded {len(self.activities)} activities | "
                f"{len(self._mission_index)} missions | "
                f"{len(self._bot_id_index)} bot_id entries"
            )
        except Exception as e:
            logger.exception(f"Error loading CSV: {e}")

    # ------------------------------------------------------------------
    def get_activity(self, activity_id: str) -> Optional[Dict[str, Any]]:
        if not activity_id:
            return None
        aid = str(activity_id).strip()
        if aid in self.activities:
            return self.activities[aid]
        # Handle "123.0" → "123"
        if "." in aid:
            base = aid.split(".")[0]
            if base in self.activities:
                return self.activities[base]
        return None

    def get_by_bot_id(self, bot_id: str) -> Optional[Dict[str, Any]]:
        if not bot_id:
            return None
        aid = self._bot_id_index.get(str(bot_id).strip())
        return self.activities.get(aid) if aid else None

    def get_mission_activities(self, mission_id: str) -> List[Dict[str, Any]]:
        """Return all activities in a mission, ordered."""
        ids = self._mission_index.get(mission_id, [])
        return [self.activities[i] for i in ids if i in self.activities]

    def get_consecutive_activities(
        self,
        mission_id: str,
        count: int,
        start_order: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return `count` consecutive ACTIVE activities from a mission.
        If start_order is provided, start from the first activity at or after that order.
        Otherwise start from the beginning.
        """
        all_in_mission = self.get_mission_activities(mission_id)
        active = [a for a in all_in_mission if a.get("status", "").upper() == "ACTIVE"]
        if not active:
            return []

        if start_order is not None:
            active = [a for a in active if a["order"] >= start_order]

        return active[:count]

    def get_all_missions(self) -> List[str]:
        return sorted(self._mission_index.keys())

    def get_missions_by_level(self, level_prefix: str) -> List[str]:
        """e.g. level_prefix='preA1' returns all preA1_* missions."""
        missions = [m for m in self._mission_index if m.startswith(level_prefix)]
        # Sort numerically e.g. preA1_1, preA1_2, ..., preA1_10
        try:
            missions.sort(key=lambda x: int(x.split('_')[-1]) if '_' in x and x.split('_')[-1].isdigit() else 9999)
        except Exception:
            missions.sort()
        return missions

    def get_next_missions(self, level_prefix: str, last_mission: Optional[str] = None, count: int = 5) -> List[str]:
        """Get the next `count` missions after `last_mission` for a given level."""
        all_missions = self.get_missions_by_level(level_prefix)
        if not all_missions:
            return []
            
        start_idx = 0
        if last_mission and last_mission in all_missions:
            start_idx = all_missions.index(last_mission) + 1
            
        return all_missions[start_idx:start_idx + count]


# Singleton
db = LearningDB()
