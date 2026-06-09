from pydantic import BaseModel
from typing import Optional, Dict, Any

class EvalSessionCreate(BaseModel):
    phone: Optional[str] = ""
    profile_id: str
    profile_name: Optional[str] = ""

class EvalSessionPatch(BaseModel):
    current_step: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    totals: Optional[Dict[str, Any]] = None

class EvalSessionSummaryOut(BaseModel):
    id: str
    created_at: str
    updated_at: str
    phone: str
    profile_id: str
    profile_name: str
    current_step: str
    data: Optional[Dict[str, Any]] = None
    totals: Optional[Dict[str, Any]] = None
