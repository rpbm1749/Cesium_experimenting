from config import *

def estimate_vehicle_emissions(population):
    trips = population * TRIPS_PER_PERSON
    vehicles_tw = (trips * MODE_SPLIT["two_wheeler"]) / OCCUPANCY["two_wheeler"]
    vehicles_car = (trips * MODE_SPLIT["car"]) / OCCUPANCY["car"]

    vkt_tw = vehicles_tw * AVG_KM["two_wheeler"]
    vkt_car = vehicles_car * AVG_KM["car"]

    qs_day = {}
    for gas in EMISSION_FACTORS["car"]:
        q = (
            vkt_tw * EMISSION_FACTORS["two_wheeler"][gas] +
            vkt_car * EMISSION_FACTORS["car"][gas]
        )
        if "pm" in gas:
            q *= ROAD_DUST_FACTOR
        qs_day[gas] = q / SECONDS_PER_DAY

    return qs_day
