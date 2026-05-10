package store

import "github.com/cyber-hub/cyber-hub/internal/models"

func ListAttackLayers() ([]models.AttackLayer, error) {
	var layers []models.AttackLayer
	err := DB.Order("updated_at DESC").Find(&layers).Error
	return layers, err
}

func GetAttackLayerByID(id uint) (*models.AttackLayer, error) {
	var layer models.AttackLayer
	if err := DB.First(&layer, id).Error; err != nil {
		return nil, err
	}
	return &layer, nil
}

func CreateAttackLayer(layer *models.AttackLayer) error {
	return DB.Create(layer).Error
}

func UpdateAttackLayer(id uint, updates map[string]interface{}) (*models.AttackLayer, error) {
	if err := DB.Model(&models.AttackLayer{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetAttackLayerByID(id)
}

func DeleteAttackLayer(id uint) error {
	return DB.Delete(&models.AttackLayer{}, id).Error
}
