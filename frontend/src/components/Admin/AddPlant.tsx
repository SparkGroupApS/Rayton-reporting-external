import { PlantPublic, useCreatePlant } from "@/hooks/usePlantQueries";
import {
  Button,
  Field,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export default function AddPlant() {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: createPlant, isPending, isError, error } = useCreatePlant()

  const [formData, setFormData] = useState<Partial<PlantPublic>>({
    PLANT_ID: undefined,
    latitude: null,
    longitude: null,
    timezone: "Europe/Kyiv",
    TEXT_L1: "",
    TEXT_L2: "",
    tab_config: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    let processedValue: string | number | null = value

    // Convert numeric fields
    if (name === "PLANT_ID" || name === "latitude" || name === "longitude") {
      processedValue = value === "" ? null : Number(value)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }))
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.PLANT_ID || !formData.timezone) {
      alert("PLANT_ID and Timezone are required fields");
      return
    }

    createPlant(formData as Omit<PlantPublic, 'ID' | 'created_at' | 'updated_at'>, {
      onSuccess: () => {
        alert("Plant created successfully");
        setIsOpen(false);
        setFormData({
          PLANT_ID: undefined,
          latitude: null,
          longitude: null,
          timezone: "Europe/Kyiv",
          TEXT_L1: "",
          TEXT_L2: "",
          tab_config: "",
        })
      },
    })
  }

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open)
    if (!open) {
      setFormData({
        PLANT_ID: undefined,
        latitude: null,
        longitude: null,
        timezone: "Europe/Kyiv",
        TEXT_L1: "",
        TEXT_L2: "",
        tab_config: "",
      })
    }
  }

  return (
    <DialogRoot size={{ base: "xs", md: "md" }} placement="center" open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" colorScheme="rayton_orange">Add Plant</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Plant</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Fill in the form below to add a new plant.</Text>
            <VStack gap={4}>
              <Field.Root id="plant-id" required>
                <Field.Label>Plant ID</Field.Label>
                <Input
                  id="PLANT_ID"
                  name="PLANT_ID"
                  type="number"
                  value={formData.PLANT_ID ?? ""}
                  onChange={handleChange}
                  placeholder="Plant ID"
                />
              </Field.Root>

              <Field.Root id="latitude">
                <Field.Label>Latitude</Field.Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude ?? ""}
                  onChange={handleChange}
                  placeholder="Latitude"
                />
              </Field.Root>

              <Field.Root id="longitude">
                <Field.Label>Longitude</Field.Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude ?? ""}
                  onChange={handleChange}
                  placeholder="Longitude"
                />
              </Field.Root>

              <Field.Root id="timezone" required>
                <Field.Label>Timezone</Field.Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="Timezone (e.g., Europe/Kyiv)"
                />
              </Field.Root>

              <Field.Root id="text-l1">
                <Field.Label>Text L1</Field.Label>
                <Input
                  id="TEXT_L1"
                  name="TEXT_L1"
                  value={formData.TEXT_L1 ?? ""}
                  onChange={handleChange}
                  placeholder="Text L1"
                />
              </Field.Root>

              <Field.Root id="text-l2">
                <Field.Label>Text L2</Field.Label>
                <Input
                  id="TEXT_L2"
                  name="TEXT_L2"
                  value={formData.TEXT_L2 ?? ""}
                  onChange={handleChange}
                  placeholder="Text L2"
                />
              </Field.Root>

              <Field.Root id="tab-config">
                <Field.Label>Tab Configuration</Field.Label>
                <Textarea
                  id="tab_config"
                  name="tab_config"
                  value={formData.tab_config ?? ""}
                  onChange={handleChange}
                  placeholder="Tab configuration JSON (optional)"
                  rows={4}
                />
              </Field.Root>
            </VStack>

            {isError && (
              <Text color="red.500" fontSize="sm" mt={2}>
                Error: {error instanceof Error ? error.message : "Failed to create plant"}
              </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isPending}
                type="button"
                onClick={() => handleOpenChange({ open: false })}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="rayton_orange"
              type="submit"
              disabled={isPending}
              loading={isPending}
            >
              Create Plant
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}
