from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.models.chore import ChoreCreate, ChoreUpdate, ChoreResponse
from app.middleware.auth import get_current_user, require_parent, require_child
from app.services import chore_service

router = APIRouter()


@router.get("", response_model=List[ChoreResponse])
def get_chores(current_user: dict = Depends(get_current_user)):
    uid = current_user["sub"]
    if current_user["role"] == "parent":
        return chore_service.get_chores_for_parent(uid)
    return chore_service.get_chores_for_child(uid)


@router.post("", response_model=ChoreResponse, status_code=status.HTTP_201_CREATED)
def create_chore(body: ChoreCreate, current_user: dict = Depends(require_parent)):
    try:
        return chore_service.create_chore(current_user["sub"], body)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{chore_id}", response_model=ChoreResponse)
def update_chore(chore_id: str, body: ChoreUpdate, current_user: dict = Depends(require_parent)):
    try:
        return chore_service.update_chore(chore_id, current_user["sub"], body)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{chore_id}/complete", response_model=ChoreResponse)
def complete_chore(chore_id: str, current_user: dict = Depends(require_child)):
    try:
        return chore_service.complete_chore(chore_id, current_user["sub"])
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{chore_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chore(chore_id: str, current_user: dict = Depends(require_parent)):
    try:
        chore_service.delete_chore(chore_id, current_user["sub"])
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
