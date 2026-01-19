from pydantic import BaseModel

class BBoxRequest(BaseModel):
    minLat: float
    minLon: float
    maxLat: float
    maxLon: float
