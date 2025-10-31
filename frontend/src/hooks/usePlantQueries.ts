// frontend/src/hooks/usePlantQueries.ts
import { useQuery } from "@tanstack/react-query"
import type { ApiError } from "@/client"

// Define the Plant type based on your PlantList model
export interface PlantPublic {
  ID: number
  PLANT_ID: number
  latitude: number | null
  longitude: number | null
  timezone: string
  TEXT_L1: string | null
  TEXT_L2: string | null
  created_at: string
  updated_at: string
}

// Hook to get plant by ID
export const usePlant = (plantId: number | null) => {
  return useQuery<PlantPublic, ApiError>({
    queryKey: ["plant", plantId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/plants/${plantId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      )
      if (!response.ok) {
        throw new Error("Failed to fetch plant")
      }
      return response.json()
    },
    enabled: !!plantId,
    staleTime: 60 * 60 * 1000,
  })
}

// Hook to get all plants (for superuser tenant list)
export const useAllPlants = () => {
  return useQuery<PlantPublic[], ApiError>({
    queryKey: ["plants", "all"],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/plants/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      )
      if (!response.ok) {
        throw new Error("Failed to fetch plants")
      }
      return response.json()
    },
    staleTime: 60 * 60 * 1000,
  })
}