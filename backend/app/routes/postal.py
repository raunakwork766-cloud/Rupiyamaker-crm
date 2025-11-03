from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import aiohttp
from typing import Dict, Any, List

router = APIRouter(
    prefix="/postal",
    tags=["Postal Services"]
)

@router.get("/lookup/{pincode}")
async def lookup_pincode(pincode: str) -> Dict[str, Any]:
    """
    Lookup city and state information for a given pincode using India Post API
    """
    try:
        # Validate pincode format (6 digits)
        if not pincode.isdigit() or len(pincode) != 6:
            raise HTTPException(status_code=400, detail="Invalid pincode format. Must be 6 digits.")
        
        # Use India Post API for pincode lookup
        url = f"https://api.postalpincode.in/pincode/{pincode}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                data = await response.json()
        
        if not data or data[0].get("Status") != "Success":
            raise HTTPException(status_code=404, detail="Pincode not found")
            
        post_offices = data[0].get("PostOffice", [])
        
        if not post_offices:
            raise HTTPException(status_code=404, detail="No post office data found for this pincode")
        
        # Extract unique cities and state
        cities = list(set([po.get("District", "") for po in post_offices if po.get("District")]))
        states = list(set([po.get("State", "") for po in post_offices if po.get("State")]))
        
        # Get the first post office for primary data
        primary_office = post_offices[0]
        
        return {
            "pincode": pincode,
            "city": primary_office.get("District", ""),
            "state": primary_office.get("State", ""),
            "country": "India",
            "cities": cities,
            "post_offices": [
                {
                    "name": po.get("Name", ""),
                    "district": po.get("District", ""),
                    "state": po.get("State", ""),
                    "division": po.get("Division", ""),
                    "region": po.get("Region", ""),
                    "circle": po.get("Circle", "")
                }
                for po in post_offices
            ]
        }
        
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=503, detail=f"Error fetching pincode data: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/cities/{state}")
async def get_cities_by_state(state: str) -> Dict[str, Any]:
    """
    Get list of cities for a given state (for dropdown purposes)
    Note: This is a simplified implementation. In production, you'd want a proper database of cities.
    """
    try:
        # For now, return a basic response. In production, implement proper city database
        return {
            "state": state,
            "cities": [f"City in {state}"],  # Placeholder - implement proper city lookup
            "message": "Use pincode lookup for accurate city data"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cities: {str(e)}")
