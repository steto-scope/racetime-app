# Generated by Django 3.0.2 on 2020-01-25 09:55

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('racetime', '0008_user_profile_bio'),
    ]

    operations = [
        migrations.AlterField(
            model_name='message',
            name='deleted',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name='message',
            name='posted_at',
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]
