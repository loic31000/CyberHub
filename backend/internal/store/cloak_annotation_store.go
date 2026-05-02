package store

import (
	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm/clause"
)

// ListCloakAnnotations retourne toutes les annotations utilisateur.
func ListCloakAnnotations() ([]models.CloakAnnotation, error) {
	var items []models.CloakAnnotation
	err := DB.Order("updated_at desc").Find(&items).Error
	return items, err
}

// UpsertCloakAnnotation crée ou met à jour une annotation par technique_ref (clé unique).
func UpsertCloakAnnotation(req models.CloakAnnotationRequest) (models.CloakAnnotation, error) {
	ann := models.CloakAnnotation{
		TechniqueRef: req.TechniqueRef,
		UserNotes:    req.UserNotes,
		Status:       req.Status,
		CounterNotes: req.CounterNotes,
		Tags:         req.Tags,
	}
	err := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "technique_ref"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_notes", "status", "counter_notes", "tags", "updated_at",
		}),
	}).Create(&ann).Error
	if err != nil {
		return ann, err
	}
	// Recharger pour avoir l'ID et les timestamps mis à jour
	DB.Where("technique_ref = ?", req.TechniqueRef).First(&ann)
	return ann, nil
}

// DeleteCloakAnnotation supprime une annotation par ID (reset — la fiche CLOAK est inchangée).
func DeleteCloakAnnotation(id uint) error {
	return DB.Delete(&models.CloakAnnotation{}, id).Error
}

// DeleteCloakAnnotationByRef supprime une annotation par technique_ref.
func DeleteCloakAnnotationByRef(ref string) error {
	return DB.Where("technique_ref = ?", ref).Delete(&models.CloakAnnotation{}).Error
}

// GetCloakAnnotationByRef retourne l'annotation pour une technique donnée (404 si absente).
func GetCloakAnnotationByRef(ref string) (models.CloakAnnotation, error) {
	var ann models.CloakAnnotation
	err := DB.Where("technique_ref = ?", ref).First(&ann).Error
	return ann, err
}
