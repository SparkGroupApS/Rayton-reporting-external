import { PlantPublic, useDeletePlant, useUpdatePlant } from "@/hooks/usePlantQueries";
import {
  Button,
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Field,
  IconButton,
  Input,
  Kbd,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaEllipsisV } from "react-icons/fa";

// Import custom UI components
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger
} from "../ui/menu";

interface PlantActionsMenuProps {
  plant: PlantPublic;
}

export const PlantActionsMenu = ({ plant }: PlantActionsMenuProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const deletePlantMutation = useDeletePlant();
  const updatePlantMutation = useUpdatePlant();

  const handleDelete = () => {
    deletePlantMutation.mutate(plant.PLANT_ID, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
      },
    });
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  return (
    <>
      {/* Edit Plant Modal */}
      {isEditModalOpen && (
        <PlantEditModal
          plant={plant}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}

      {/* Actions Menu */}
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton variant="ghost" color="inherit" aria-label="Options">
            <FaEllipsisV />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem value="edit" onClick={handleEdit}>
            Edit
          </MenuItem>
          <MenuItem
            value="delete"
            color="red.500"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Delete
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot
        size="xs"
        open={isDeleteDialogOpen}
        onOpenChange={(e) => setIsDeleteDialogOpen(e.open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plant</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>
              Are you sure you want to delete plant <Kbd>{plant.PLANT_ID}</Kbd>?
              This action cannot be undone.
            </Text>
            {deletePlantMutation.isError && (
              <Text color="red.500" mt={2}>
                Error:{" "}
                {deletePlantMutation.error instanceof Error
                  ? deletePlantMutation.error.message
                  : "Failed to delete plant"}
              </Text>
            )}
          </DialogBody>
          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button variant="subtle" colorPalette="gray">
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorPalette="red"
              onClick={handleDelete}
              loading={deletePlantMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
        <DialogCloseTrigger />
      </DialogRoot>
    </>
  );
};

// Edit Plant Modal Component
interface PlantEditModalProps {
  plant: PlantPublic;
  isOpen: boolean;
  onClose: () => void;
}

const PlantEditModal = ({ plant, isOpen, onClose }: PlantEditModalProps) => {
  const [formData, setFormData] = useState<Partial<PlantPublic>>({
    PLANT_ID: plant.PLANT_ID,
    latitude: plant.latitude,
    longitude: plant.longitude,
    timezone: plant.timezone,
    TEXT_L1: plant.TEXT_L1,
    TEXT_L2: plant.TEXT_L2,
    tab_config: plant.tab_config,
  });

  const updatePlantMutation = useUpdatePlant();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue: string | number | null = value;

    // Convert numeric fields
    if (name === "PLANT_ID" || name === "latitude" || name === "longitude") {
      processedValue = value === "" ? null : Number(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();

    updatePlantMutation.mutate(
      { plantId: plant.PLANT_ID, plantData: formData },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleOpenChange = ({ open }: { open: boolean }) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <DialogRoot size={{ base: "xs", md: "md" }} placement="center" open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Plant</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the plant information below.</Text>
            <VStack gap={4}>
              <Field.Root id="edit-plant-id" required>
                <Field.Label>Plant ID</Field.Label>
                <Input
                  id="PLANT_ID"
                  name="PLANT_ID"
                  type="number"
                  value={formData.PLANT_ID ?? ""}
                  onChange={handleChange}
                  placeholder="Plant ID"
                  disabled // Plant ID should not be changed after creation
                />
              </Field.Root>

              <Field.Root id="edit-latitude">
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

              <Field.Root id="edit-longitude">
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

              <Field.Root id="edit-timezone" required>
                <Field.Label>Timezone</Field.Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="Timezone (e.g., Europe/Kyiv)"
                />
              </Field.Root>

              <Field.Root id="edit-text-l1">
                <Field.Label>Text L1</Field.Label>
                <Input
                  id="TEXT_L1"
                  name="TEXT_L1"
                  value={formData.TEXT_L1 ?? ""}
                  onChange={handleChange}
                  placeholder="Text L1"
                />
              </Field.Root>

              <Field.Root id="edit-text-l2">
                <Field.Label>Text L2</Field.Label>
                <Input
                  id="TEXT_L2"
                  name="TEXT_L2"
                  value={formData.TEXT_L2 ?? ""}
                  onChange={handleChange}
                  placeholder="Text L2"
                />
              </Field.Root>

              <Field.Root id="edit-tab-config">
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

            {updatePlantMutation.isError && (
              <Text color="red.500" fontSize="sm" mt={2}>
                Error:{" "}
                {updatePlantMutation.error instanceof Error
                  ? updatePlantMutation.error.message
                  : "Failed to update plant"}
              </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                type="button"
                onClick={onClose}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="rayton_orange"
              type="submit"
              disabled={updatePlantMutation.isPending}
              loading={updatePlantMutation.isPending}
            >
              Update Plant
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
