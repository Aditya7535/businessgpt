from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False)   # INVENTORY / FESTIVAL / REVENUE / TREND
    severity = Column(String(20), nullable=False)     # HIGH / MEDIUM / LOW
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    @hybrid_property
    def type(self):
        return self.alert_type

    @type.setter
    def type(self, value):
        self.alert_type = value
